import { useState, useEffect, useRef } from "react";
import { MapPin, Satellite, Calendar, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

interface MapViewProps {
  onSelectFolder: (folder: LocationFolder) => void;
}

export const MapView = ({ onSelectFolder }: MapViewProps) => {
  const [folders] = useState<LocationFolder[]>(getAllFolders());
  const [selectedFolder, setSelectedFolder] = useState<LocationFolder | null>(null);
  const [isLoadingSatellite, setIsLoadingSatellite] = useState(false);
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
        <div 
          ref={mapContainer} 
          className="relative min-h-[400px] md:min-h-full border-r"
        />

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
