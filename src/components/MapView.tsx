import { useState, useEffect, useRef } from "react";
import { MapPin, Satellite, Calendar, Plus, Map as MapIcon, Cloud, Thermometer, Wind, Droplets } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { 
  getAllFolders, 
  updateFolderSatelliteData, 
  type LocationFolder 
} from "@/lib/geolocation";
import { toast } from "sonner";
import { SatelliteOverlay } from "./SatelliteOverlay";

mapboxgl.accessToken = "pk.eyJ1Ijoid29uZGVyZmVlbCIsImEiOiJjbTEyZmdnajkwdmU3MmtzOHlvYXYyZHJvIn0.2PlXKgkiDN0s5P908aGSNQ";

// OpenWeatherMap API key - using demo key (replace with your own for production)
const OPENWEATHER_API_KEY = "439d4b804bc8187953eb36d2a8c26a02";

interface MapViewProps {
  onSelectFolder: (folder: LocationFolder) => void;
}

export const MapView = ({ onSelectFolder }: MapViewProps) => {
  const [folders] = useState<LocationFolder[]>(getAllFolders());
  const [selectedFolder, setSelectedFolder] = useState<LocationFolder | null>(null);
  const [isLoadingSatellite, setIsLoadingSatellite] = useState(false);
  const [mapStyle, setMapStyle] = useState<"streets" | "satellite">("streets");
  const [showWeatherPanel, setShowWeatherPanel] = useState(false);
  const [weatherLayers, setWeatherLayers] = useState({
    precipitation: false,
    temperature: false,
    wind: false,
    clouds: false,
  });
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    // Calculate center point from all folders or default to Europe
    let center: [number, number] = [2.3522, 48.8566]; // Default to Paris
    let zoom = 5;

    if (folders.length > 0) {
      const avgLat = folders.reduce((sum, f) => sum + f.coordinates.latitude, 0) / folders.length;
      const avgLon = folders.reduce((sum, f) => sum + f.coordinates.longitude, 0) / folders.length;
      center = [avgLon, avgLat];
      zoom = folders.length === 1 ? 14 : 10;
    }

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center,
      zoom,
    });

    // Add navigation controls
    map.current.addControl(
      new mapboxgl.NavigationControl(),
      "top-right"
    );

    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      map.current?.remove();
    };
  }, []);

  // Add markers for folders
  useEffect(() => {
    if (!map.current) return;

    // Clear existing markers
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    // Add markers for each folder
    folders.forEach((folder) => {
      const el = document.createElement("div");
      el.className = "mapbox-marker";
      el.style.width = "32px";
      el.style.height = "32px";
      el.style.cursor = "pointer";
      el.innerHTML = `
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" fill="hsl(var(--primary))" stroke="white" stroke-width="2"/>
          <circle cx="12" cy="10" r="3" fill="white"/>
        </svg>
      `;

      const marker = new mapboxgl.Marker(el)
        .setLngLat([folder.coordinates.longitude, folder.coordinates.latitude])
        .addTo(map.current!);

      // Add click handler
      el.addEventListener("click", () => {
        setSelectedFolder(folder);
        map.current?.flyTo({
          center: [folder.coordinates.longitude, folder.coordinates.latitude],
          zoom: 15,
          duration: 1000,
        });
      });

      markersRef.current.push(marker);
    });
  }, [folders]);

  // Toggle map style
  const toggleMapStyle = () => {
    if (!map.current) return;

    const newStyle = mapStyle === "streets" ? "satellite" : "streets";
    const styleUrl = newStyle === "streets" 
      ? "mapbox://styles/mapbox/streets-v12" 
      : "mapbox://styles/mapbox/satellite-streets-v12";

    map.current.setStyle(styleUrl);
    setMapStyle(newStyle);

    // Re-add weather layers after style loads
    map.current.once("styledata", () => {
      reapplyWeatherLayers();
    });
  };

  // Apply or remove weather layers
  const reapplyWeatherLayers = () => {
    if (!map.current) return;

    // Remove existing weather layers
    const layerIds = ["precipitation-layer", "temperature-layer", "wind-layer", "clouds-layer"];
    layerIds.forEach((layerId) => {
      if (map.current!.getLayer(layerId)) {
        map.current!.removeLayer(layerId);
      }
      if (map.current!.getSource(layerId)) {
        map.current!.removeSource(layerId);
      }
    });

    // Add active weather layers
    Object.entries(weatherLayers).forEach(([layer, isActive]) => {
      if (isActive && map.current) {
        addWeatherLayer(layer as keyof typeof weatherLayers);
      }
    });
  };

  const addWeatherLayer = (layerType: keyof typeof weatherLayers) => {
    if (!map.current) return;

    const layerConfigs = {
      precipitation: {
        id: "precipitation-layer",
        tiles: `https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=${OPENWEATHER_API_KEY}`,
        opacity: 0.6,
      },
      temperature: {
        id: "temperature-layer",
        tiles: `https://tile.openweathermap.org/map/temp_new/{z}/{x}/{y}.png?appid=${OPENWEATHER_API_KEY}`,
        opacity: 0.5,
      },
      wind: {
        id: "wind-layer",
        tiles: `https://tile.openweathermap.org/map/wind_new/{z}/{x}/{y}.png?appid=${OPENWEATHER_API_KEY}`,
        opacity: 0.5,
      },
      clouds: {
        id: "clouds-layer",
        tiles: `https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=${OPENWEATHER_API_KEY}`,
        opacity: 0.4,
      },
    };

    const config = layerConfigs[layerType];

    // Add source
    if (!map.current.getSource(config.id)) {
      map.current.addSource(config.id, {
        type: "raster",
        tiles: [config.tiles],
        tileSize: 256,
      });
    }

    // Add layer
    if (!map.current.getLayer(config.id)) {
      map.current.addLayer({
        id: config.id,
        type: "raster",
        source: config.id,
        paint: {
          "raster-opacity": config.opacity,
        },
      });
    }
  };

  const toggleWeatherLayer = (layerType: keyof typeof weatherLayers) => {
    const newState = !weatherLayers[layerType];
    setWeatherLayers((prev) => ({ ...prev, [layerType]: newState }));

    if (!map.current) return;

    if (newState) {
      addWeatherLayer(layerType);
    } else {
      const layerId = `${layerType}-layer`;
      if (map.current.getLayer(layerId)) {
        map.current.removeLayer(layerId);
      }
      if (map.current.getSource(layerId)) {
        map.current.removeSource(layerId);
      }
    }
  };

  const handleFetchSatellite = async (folder: LocationFolder) => {
    setIsLoadingSatellite(true);
    try {
      await updateFolderSatelliteData(folder.id);
      const updated = getAllFolders().find((f) => f.id === folder.id);
      if (updated) {
        setSelectedFolder(updated);
      }
      toast.success("Satellite data updated");
    } catch (error) {
      toast.error("Failed to fetch satellite data");
    } finally {
      setIsLoadingSatellite(false);
    }
  };

  return (
    <div className="h-full bg-background">
      <div className="grid md:grid-cols-2 gap-0 h-full">
        {/* Mapbox Map */}
        <div className="relative min-h-[400px] md:min-h-full border-r">
          <div 
            ref={mapContainer} 
            className="absolute inset-0"
          />
          
          {/* Map Controls */}
          <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
            {/* Style Toggle */}
            <Button
              onClick={toggleMapStyle}
              variant="secondary"
              size="sm"
              className="gap-2 bg-card/95 backdrop-blur-md shadow-lg hover:shadow-xl transition-all"
            >
              {mapStyle === "streets" ? (
                <>
                  <Satellite className="h-4 w-4" />
                  Satellite
                </>
              ) : (
                <>
                  <MapIcon className="h-4 w-4" />
                  Streets
                </>
              )}
            </Button>

            {/* Weather Panel Toggle */}
            <Button
              onClick={() => setShowWeatherPanel(!showWeatherPanel)}
              variant="secondary"
              size="sm"
              className="gap-2 bg-card/95 backdrop-blur-md shadow-lg hover:shadow-xl transition-all"
            >
              <Cloud className="h-4 w-4" />
              Weather
            </Button>

            {/* Weather Layers Panel */}
            {showWeatherPanel && (
              <Card className="bg-card/95 backdrop-blur-md shadow-xl p-3 space-y-3 w-48">
                <div className="flex items-center justify-between">
                  <Label htmlFor="precipitation" className="text-xs font-medium flex items-center gap-1">
                    <Droplets className="h-3 w-3 text-blue-500" />
                    Precipitation
                  </Label>
                  <Switch
                    id="precipitation"
                    checked={weatherLayers.precipitation}
                    onCheckedChange={() => toggleWeatherLayer("precipitation")}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="temperature" className="text-xs font-medium flex items-center gap-1">
                    <Thermometer className="h-3 w-3 text-red-500" />
                    Temperature
                  </Label>
                  <Switch
                    id="temperature"
                    checked={weatherLayers.temperature}
                    onCheckedChange={() => toggleWeatherLayer("temperature")}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="wind" className="text-xs font-medium flex items-center gap-1">
                    <Wind className="h-3 w-3 text-cyan-500" />
                    Wind
                  </Label>
                  <Switch
                    id="wind"
                    checked={weatherLayers.wind}
                    onCheckedChange={() => toggleWeatherLayer("wind")}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="clouds" className="text-xs font-medium flex items-center gap-1">
                    <Cloud className="h-3 w-3 text-gray-500" />
                    Clouds
                  </Label>
                  <Switch
                    id="clouds"
                    checked={weatherLayers.clouds}
                    onCheckedChange={() => toggleWeatherLayer("clouds")}
                  />
                </div>

                <div className="pt-2 border-t">
                  <p className="text-[10px] text-muted-foreground">
                    Data: OpenWeatherMap
                  </p>
                </div>
              </Card>
            )}
          </div>
        </div>

        {/* Location Folders Sidebar */}
        <div className="overflow-y-auto h-full">
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Location Folders</h2>
              <Badge variant="secondary">{folders.length} locations</Badge>
            </div>

            {folders.length === 0 ? (
              <Card className="p-8 text-center">
                <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No location folders yet</p>
              </Card>
            ) : (
              <div className="space-y-3">
                {folders.map((folder) => (
                  <Card
                    key={folder.id}
                    className={`p-4 cursor-pointer transition-all ${
                      selectedFolder?.id === folder.id
                        ? "ring-2 ring-primary shadow-lg"
                        : "hover:shadow-md"
                    }`}
                    onClick={() => setSelectedFolder(folder)}
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold mb-1">{folder.name}</h3>
                          <div className="text-xs text-muted-foreground space-y-1">
                            <div className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              <span>
                                {folder.coordinates.latitude.toFixed(6)},{" "}
                                {folder.coordinates.longitude.toFixed(6)}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              <span>{new Date(folder.updatedAt).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>
                        <Badge variant="outline">{folder.notes.length} notes</Badge>
                      </div>

                      {selectedFolder?.id === folder.id && (
                        <div className="space-y-3 pt-3 border-t">
                          {folder.satelliteData && (
                            <SatelliteOverlay data={folder.satelliteData} />
                          )}
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleFetchSatellite(folder);
                              }}
                              disabled={isLoadingSatellite}
                              className="flex-1"
                            >
                              <Satellite className="h-4 w-4 mr-2" />
                              {isLoadingSatellite ? "Fetching..." : "Get Data"}
                            </Button>
                            <Button
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectFolder(folder);
                              }}
                              className="flex-1"
                            >
                              <Plus className="h-4 w-4 mr-2" />
                              View Details
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
