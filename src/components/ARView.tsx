import { useState, useEffect, useRef } from "react";
import { Camera, Navigation, Plus, List, CameraOff, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import geoTaggerLogo from "@/assets/geotagger-logo.png";
import { NoteForm } from "@/components/NoteForm";
import { LocationCreator } from "@/components/LocationCreator";
import { ProximityAlert } from "@/components/ProximityAlert";
import {
  watchGeolocation,
  clearGeolocationWatch,
  type LocationCoordinates,
  getNearbyFolders,
  type LocationFolder,
  findOrCreateFolder,
  addNoteToFolder,
  getAllFolders,
} from "@/lib/geolocation";
import { toast } from "sonner";

interface ARViewProps {
  onViewNotes: () => void;
}

export const ARView = ({ onViewNotes }: ARViewProps) => {
  const [currentLocation, setCurrentLocation] = useState<LocationCoordinates | null>(null);
  const [showLocationCreator, setShowLocationCreator] = useState(false);
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [currentFolder, setCurrentFolder] = useState<LocationFolder | null>(null);
  const [nearbyFolders, setNearbyFolders] = useState<LocationFolder[]>([]);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const watchIdRef = useRef<number>(-1);

  useEffect(() => {
    // Request camera access
    const startCamera = async () => {
      if (!cameraEnabled) return;
      
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        setCameraStream(stream);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (error) {
        toast.error("Camera access denied. AR features will be limited.");
      }
    };

    if (cameraEnabled) {
      startCamera();
    } else {
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
        setCameraStream(null);
      }
    }

    // Start watching location
    watchIdRef.current = watchGeolocation(
      (coords) => {
        setCurrentLocation(coords);
        const nearby = getNearbyFolders(coords.latitude, coords.longitude);
        setNearbyFolders(nearby);
      },
      (error) => {
        toast.error(`Location error: ${error.message}`);
      }
    );

    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
      }
      if (watchIdRef.current !== -1) {
        clearGeolocationWatch(watchIdRef.current);
      }
    };
  }, [cameraEnabled]);

  useEffect(() => {
    if (videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream;
    }
  }, [cameraStream]);

  const handleAddNoteClick = () => {
    if (!currentLocation) return;

    // Check if a folder exists at this location
    const existingFolder = findOrCreateFolder(currentLocation);
    
    if (existingFolder.notes.length === 0) {
      // New location - show location creator first
      setShowLocationCreator(true);
    } else {
      // Existing location - go straight to note form
      setCurrentFolder(existingFolder);
      setShowNoteForm(true);
    }
  };

  const handleLocationCreated = (folderName: string) => {
    if (!currentLocation) return;

    const folder = findOrCreateFolder(currentLocation);
    
    // Update folder name if it was just created
    const { renameFolder } = require("@/lib/geolocation");
    renameFolder(folder.id, folderName);
    
    // Refresh to get updated folder
    const updatedFolders = getAllFolders();
    const updatedFolder = updatedFolders.find((f) => f.id === folder.id);
    
    setCurrentFolder(updatedFolder || folder);
    setShowLocationCreator(false);
    setShowNoteForm(true);
    toast.success("Location folder created!");
  };

  const handleNoteSaved = (noteText: string) => {
    if (!currentLocation || !currentFolder) return;

    addNoteToFolder(currentFolder.id, noteText);
    setShowNoteForm(false);
    setCurrentFolder(null);
    toast.success("Note saved to location folder!");
    
    // Refresh nearby folders
    const nearby = getNearbyFolders(currentLocation.latitude, currentLocation.longitude);
    setNearbyFolders(nearby);
  };

  const toggleCamera = () => {
    setCameraEnabled(!cameraEnabled);
    toast.info(cameraEnabled ? "Camera off" : "Camera on");
  };

  const takeScreenshot = () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const video = videoRef.current;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `geotagger-${Date.now()}.png`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success("Screenshot saved!");
    });
  };

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-background">
      {/* Hidden canvas for screenshots */}
      <canvas ref={canvasRef} className="hidden" />
      
      {/* Camera feed */}
      {cameraEnabled ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 bg-muted flex items-center justify-center">
          <div className="text-center">
            <CameraOff className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Camera is off</p>
          </div>
        </div>
      )}

      {/* AR Overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-background/20 via-transparent to-background/40">
        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <img src={geoTaggerLogo} alt="GeoTagger" className="h-10 w-10 rounded-lg shadow-lg" />
            <div className="flex items-center gap-2 bg-card/80 backdrop-blur-md px-3 py-2 rounded-full shadow-md">
              <Navigation className="h-4 w-4 text-primary animate-pulse" />
              <span className="text-xs font-medium">
                {currentLocation
                  ? `${currentLocation.accuracy.toFixed(0)}m accuracy`
                  : "Locating..."}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleCamera}
              className="bg-card/80 backdrop-blur-md rounded-full shadow-md hover:bg-card"
            >
              {cameraEnabled ? <Camera className="h-5 w-5" /> : <CameraOff className="h-5 w-5" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={takeScreenshot}
              disabled={!cameraEnabled}
              className="bg-card/80 backdrop-blur-md rounded-full shadow-md hover:bg-card disabled:opacity-50"
            >
              <Download className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* AR Location markers */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {nearbyFolders.map((folder) => (
            <div
              key={folder.id}
              className="absolute bg-primary/90 backdrop-blur-md px-4 py-2 rounded-lg shadow-lg animate-pulse"
              style={{
                transform: "translate(-50%, -50%)",
              }}
            >
              <p className="text-primary-foreground text-sm font-medium">{folder.name}</p>
              <p className="text-primary-foreground/80 text-xs">{folder.notes.length} notes</p>
            </div>
          ))}
        </div>

        {/* Bottom controls - adjusted for bottom nav */}
        <div className="absolute bottom-20 left-0 right-0 p-6 flex flex-col items-center gap-4 z-10">
          {currentLocation && (
            <div className="bg-card/80 backdrop-blur-md px-4 py-2 rounded-full text-xs text-muted-foreground shadow-md">
              {currentLocation.latitude.toFixed(6)}, {currentLocation.longitude.toFixed(6)}
              {currentLocation.altitude && ` • ${currentLocation.altitude.toFixed(0)}m`}
            </div>
          )}
          <Button
            size="lg"
            onClick={handleAddNoteClick}
            disabled={!currentLocation}
            className="rounded-full bg-gradient-to-r from-primary to-accent shadow-lg hover:shadow-xl transition-all"
          >
            <Plus className="h-5 w-5 mr-2" />
            Add Note Here
          </Button>
        </div>
      </div>

      {/* Location creator modal */}
      {showLocationCreator && currentLocation && (
        <LocationCreator
          currentLocation={currentLocation}
          onClose={() => setShowLocationCreator(false)}
          onCreate={handleLocationCreated}
        />
      )}

      {/* Note form modal */}
      {showNoteForm && currentLocation && currentFolder && (
        <NoteForm
          currentLocation={currentLocation}
          folderName={currentFolder.name}
          onClose={() => {
            setShowNoteForm(false);
            setCurrentFolder(null);
          }}
          onSave={handleNoteSaved}
        />
      )}

      {/* Proximity alerts */}
      {nearbyFolders.length > 0 && (
        <ProximityAlert folders={nearbyFolders} />
      )}
    </div>
  );
};
