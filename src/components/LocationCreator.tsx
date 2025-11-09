import { useState } from "react";
import { MapPin, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { type LocationCoordinates } from "@/lib/geolocation";

interface LocationCreatorProps {
  currentLocation: LocationCoordinates;
  onClose: () => void;
  onCreate: (folderName: string) => void;
}

export const LocationCreator = ({ 
  currentLocation, 
  onClose, 
  onCreate 
}: LocationCreatorProps) => {
  const [folderName, setFolderName] = useState(
    `Location: ${currentLocation.latitude.toFixed(6)}, ${currentLocation.longitude.toFixed(6)}`
  );

  const handleCreate = () => {
    if (!folderName.trim()) return;
    onCreate(folderName.trim());
  };

  return (
    <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-md p-6 space-y-4 animate-in fade-in slide-in-from-bottom-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-lg">Create Location Folder</h3>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            <p>Lat: {currentLocation.latitude.toFixed(6)}</p>
            <p>Lon: {currentLocation.longitude.toFixed(6)}</p>
            {currentLocation.altitude && (
              <p>Alt: {currentLocation.altitude.toFixed(0)}m</p>
            )}
            <p className="text-xs mt-1">Accuracy: ±{currentLocation.accuracy.toFixed(0)}m</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="folder-name">Location Name</Label>
            <Input
              id="folder-name"
              placeholder="e.g., North Field, Home Garden"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
            <p className="text-xs text-muted-foreground">
              All notes at this location will be grouped under this folder
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!folderName.trim()}
            className="flex-1 bg-gradient-to-r from-primary to-accent"
          >
            <Save className="h-4 w-4 mr-2" />
            Create Location
          </Button>
        </div>
      </Card>
    </div>
  );
};
