import { useState, useEffect, useRef } from "react";
import { MapPin, Satellite, Calendar, Plus, Map as MapIcon, Cloud, Thermometer, Wind, Droplets, Layers, FolderOpen, ChevronLeft, ChevronRight, Check, X } from "lucide-react";
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
  findOrCreateFolder,
  type LocationFolder,
  type LocationCoordinates
} from "@/lib/geolocation";
import {
  fetchNDVIData,
  fetchSoilMoistureData,
  fetchTemperatureData,
  generateHeatmapCanvas,
  type SatelliteDataGrid,
} from "@/lib/satelliteData";
import { toast } from "sonner";
import { SatelliteOverlay } from "./SatelliteOverlay";
import { SatelliteDataIndicators } from "./SatelliteDataIndicators";

mapboxgl.accessToken = "pk.eyJ1Ijoid29uZGVyZmVlbCIsImEiOiJjbTEyZmdnajkwdmU3MmtzOHlvYXYyZHJvIn0.2PlXKgkiDN0s5P908aGSNQ";

// OpenWeatherMap API key - using demo key (replace with your own for production)
const OPENWEATHER_API_KEY = "439d4b804bc8187953eb36d2a8c26a02";

interface MapViewProps {
  onSelectFolder: (folder: LocationFolder) => void;
}

export const MapView = ({ onSelectFolder }: MapViewProps) => {
  const [folders, setFolders] = useState<LocationFolder[]>(getAllFolders());
  const [selectedFolder, setSelectedFolder] = useState<LocationFolder | null>(null);
  const [isLoadingSatellite, setIsLoadingSatellite] = useState(false);
  const [mapStyle, setMapStyle] = useState<"streets" | "satellite">("streets");
  const [showWeatherPanel, setShowWeatherPanel] = useState(false);
  const [showDataPanel, setShowDataPanel] = useState(false);
  const [showFoldersPanel, setShowFoldersPanel] = useState(false);
  const [isCreatingLocation, setIsCreatingLocation] = useState(false);
  const [newLocationCoords, setNewLocationCoords] = useState<{lat: number, lng: number} | null>(null);
  const [weatherLayers, setWeatherLayers] = useState({
    precipitation: false,
    temperature: false,
    wind: false,
    clouds: false,
  });
  const [dataOverlays, setDataOverlays] = useState({
    ndvi: false,
    soilMoisture: false,
    temperature: false,
  });
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const dataOverlayRefs = useRef<{ [key: string]: string }>({});
  const newLocationMarkerRef = useRef<mapboxgl.Marker | null>(null);

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

  // Data overlay management
  const toggleDataOverlay = async (overlayType: keyof typeof dataOverlays) => {
    const newState = !dataOverlays[overlayType];
    setDataOverlays((prev) => ({ ...prev, [overlayType]: newState }));

    if (!map.current || !selectedFolder) {
      if (newState && !selectedFolder) {
        toast.error("Please select a location first");
        setDataOverlays((prev) => ({ ...prev, [overlayType]: false }));
      }
      return;
    }

    if (newState) {
      await addDataOverlay(overlayType, selectedFolder);
    } else {
      removeDataOverlay(overlayType);
    }
  };

  const addDataOverlay = async (
    overlayType: keyof typeof dataOverlays,
    folder: LocationFolder
  ) => {
    if (!map.current) return;

    try {
      toast.info(`Loading ${overlayType} data...`);

      let dataGrid: SatelliteDataGrid;
      let colorScheme: "ndvi" | "moisture" | "temperature";

      switch (overlayType) {
        case "ndvi":
          dataGrid = await fetchNDVIData(folder.coordinates.latitude, folder.coordinates.longitude);
          colorScheme = "ndvi";
          break;
        case "soilMoisture":
          dataGrid = await fetchSoilMoistureData(folder.coordinates.latitude, folder.coordinates.longitude);
          colorScheme = "moisture";
          break;
        case "temperature":
          dataGrid = await fetchTemperatureData(folder.coordinates.latitude, folder.coordinates.longitude);
          colorScheme = "temperature";
          break;
      }

      // Generate heatmap canvas
      const canvas = generateHeatmapCanvas(dataGrid, colorScheme);
      const imageUrl = canvas.toDataURL();

      const sourceId = `data-overlay-${overlayType}`;
      const layerId = `data-overlay-layer-${overlayType}`;

      // Remove existing if present
      if (map.current.getLayer(layerId)) {
        map.current.removeLayer(layerId);
      }
      if (map.current.getSource(sourceId)) {
        map.current.removeSource(sourceId);
      }

      // Add image source
      map.current.addSource(sourceId, {
        type: "image",
        url: imageUrl,
        coordinates: [
          [dataGrid.bounds.west, dataGrid.bounds.north],
          [dataGrid.bounds.east, dataGrid.bounds.north],
          [dataGrid.bounds.east, dataGrid.bounds.south],
          [dataGrid.bounds.west, dataGrid.bounds.south],
        ],
      });

      // Add raster layer
      map.current.addLayer({
        id: layerId,
        type: "raster",
        source: sourceId,
        paint: {
          "raster-opacity": 0.65,
        },
      });

      dataOverlayRefs.current[overlayType] = sourceId;
      toast.success(`${overlayType} overlay added`);
    } catch (error) {
      toast.error(`Failed to load ${overlayType} data`);
      console.error(error);
    }
  };

  const removeDataOverlay = (overlayType: keyof typeof dataOverlays) => {
    if (!map.current) return;

    const sourceId = `data-overlay-${overlayType}`;
    const layerId = `data-overlay-layer-${overlayType}`;

    if (map.current.getLayer(layerId)) {
      map.current.removeLayer(layerId);
    }
    if (map.current.getSource(sourceId)) {
      map.current.removeSource(sourceId);
    }

    delete dataOverlayRefs.current[overlayType];
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

  const startLocationCreation = () => {
    if (!map.current) return;
    
    setIsCreatingLocation(true);
    const center = map.current.getCenter();
    setNewLocationCoords({ lat: center.lat, lng: center.lng });

    // Create draggable marker
    const el = document.createElement("div");
    el.className = "mapbox-marker-new";
    el.style.width = "40px";
    el.style.height = "40px";
    el.style.cursor = "move";
    el.innerHTML = `
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" fill="hsl(var(--primary))" stroke="white" stroke-width="2"/>
        <circle cx="12" cy="10" r="3" fill="white"/>
      </svg>
    `;

    const marker = new mapboxgl.Marker({ element: el, draggable: true })
      .setLngLat([center.lng, center.lat])
      .addTo(map.current);

    marker.on('drag', () => {
      const lngLat = marker.getLngLat();
      setNewLocationCoords({ lat: lngLat.lat, lng: lngLat.lng });
    });

    newLocationMarkerRef.current = marker;
  };

  const confirmLocationCreation = () => {
    if (!newLocationCoords) return;

    const coordinates: LocationCoordinates = {
      latitude: newLocationCoords.lat,
      longitude: newLocationCoords.lng,
      altitude: null,
      accuracy: 10,
      timestamp: Date.now()
    };

    const newFolder = findOrCreateFolder(coordinates);
    setFolders(getAllFolders());
    setSelectedFolder(newFolder);
    
    if (map.current) {
      map.current.flyTo({
        center: [newFolder.coordinates.longitude, newFolder.coordinates.latitude],
        zoom: 15,
        duration: 1000,
      });
    }

    cancelLocationCreation();
    toast.success("Location created successfully");
  };

  const cancelLocationCreation = () => {
    setIsCreatingLocation(false);
    setNewLocationCoords(null);
    
    if (newLocationMarkerRef.current) {
      newLocationMarkerRef.current.remove();
      newLocationMarkerRef.current = null;
    }
  };

  return (
    <div className="h-full bg-background relative">
      {/* Full Width Map */}
      <div className="absolute inset-0">
        <div 
          ref={mapContainer} 
          className="absolute inset-0"
        />
        
        {/* Map Controls - Left Side */}
        <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
          {/* Style Toggle */}
          <Button
            onClick={toggleMapStyle}
            variant="secondary"
            size="sm"
            className="gap-2 bg-blue-600 hover:bg-blue-700 text-white backdrop-blur-md shadow-lg hover:shadow-xl transition-all"
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
            className="gap-2 bg-blue-600 hover:bg-blue-700 text-white backdrop-blur-md shadow-lg hover:shadow-xl transition-all"
          >
            <Cloud className="h-4 w-4" />
            Weather
          </Button>

          {/* Data Overlays Toggle */}
          <Button
            onClick={() => setShowDataPanel(!showDataPanel)}
            variant="secondary"
            size="sm"
            className="gap-2 bg-blue-600 hover:bg-blue-700 text-white backdrop-blur-md shadow-lg hover:shadow-xl transition-all"
          >
            <Layers className="h-4 w-4" />
            Data
          </Button>

          {/* Location Folders Toggle */}
          <Button
            onClick={() => setShowFoldersPanel(!showFoldersPanel)}
            variant="secondary"
            size="sm"
            className="gap-2 bg-blue-600 hover:bg-blue-700 text-white backdrop-blur-md shadow-lg hover:shadow-xl transition-all"
          >
            <FolderOpen className="h-4 w-4" />
            Locations
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

            {/* Data Overlays Panel */}
            {showDataPanel && (
              <Card className="bg-card/95 backdrop-blur-md shadow-xl p-3 space-y-3 w-48">
                <div className="flex items-center justify-between">
                  <Label htmlFor="ndvi" className="text-xs font-medium flex items-center gap-1">
                    <div className="h-3 w-3 rounded-full bg-green-500" />
                    NDVI
                  </Label>
                  <Switch
                    id="ndvi"
                    checked={dataOverlays.ndvi}
                    onCheckedChange={() => toggleDataOverlay("ndvi")}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="soilMoisture" className="text-xs font-medium flex items-center gap-1">
                    <div className="h-3 w-3 rounded-full bg-blue-500" />
                    Soil Moisture
                  </Label>
                  <Switch
                    id="soilMoisture"
                    checked={dataOverlays.soilMoisture}
                    onCheckedChange={() => toggleDataOverlay("soilMoisture")}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="tempOverlay" className="text-xs font-medium flex items-center gap-1">
                    <div className="h-3 w-3 rounded-full bg-red-500" />
                    Temperature
                  </Label>
                  <Switch
                    id="tempOverlay"
                    checked={dataOverlays.temperature}
                    onCheckedChange={() => toggleDataOverlay("temperature")}
                  />
                </div>

                <div className="pt-2 border-t">
                  <p className="text-[10px] text-muted-foreground">
                    {selectedFolder ? "Simulated Copernicus data" : "Select a location first"}
                  </p>
                </div>
              </Card>
            )}
        </div>

        {/* Location Folders Slide-out Panel */}
        <div
          className={`absolute top-0 right-0 bottom-0 w-full md:w-96 bg-background shadow-2xl transform transition-transform duration-300 ease-in-out z-20 ${
            showFoldersPanel ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="h-full overflow-y-auto">
            <div className="p-4 space-y-4">
              <div className="space-y-3 sticky top-0 bg-background/95 backdrop-blur-md py-2 z-10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold">Location Folders</h2>
                    <Badge variant="secondary">{folders.length}</Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowFoldersPanel(false)}
                  >
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                </div>
                
                <Button
                  onClick={startLocationCreation}
                  disabled={isCreatingLocation}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Location
                </Button>
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
                      onClick={() => {
                        setSelectedFolder(folder);
                        if (map.current) {
                          map.current.flyTo({
                            center: [folder.coordinates.longitude, folder.coordinates.latitude],
                            zoom: 15,
                            duration: 1000,
                          });
                        }
                      }}
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
                            <SatelliteDataIndicators
                              latitude={folder.coordinates.latitude}
                              longitude={folder.coordinates.longitude}
                            />
                            <Button
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectFolder(folder);
                              }}
                              className="w-full"
                            >
                              <Plus className="h-4 w-4 mr-2" />
                              View Details
                            </Button>
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

        {/* Location Creation Controls */}
        {isCreatingLocation && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30">
            <Card className="bg-card/95 backdrop-blur-md shadow-xl p-4">
              <div className="flex items-center gap-3">
                <div className="text-sm">
                  <p className="font-semibold">Position the marker</p>
                  <p className="text-xs text-muted-foreground">
                    {newLocationCoords ? 
                      `${newLocationCoords.lat.toFixed(6)}, ${newLocationCoords.lng.toFixed(6)}` 
                      : 'Loading...'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={confirmLocationCreation}
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button
                    onClick={cancelLocationCreation}
                    size="sm"
                    variant="destructive"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};
