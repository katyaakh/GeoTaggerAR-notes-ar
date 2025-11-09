import { useState } from "react";
import { MainMenu } from "@/components/MainMenu";
import { ARView } from "@/components/ARView";
import { MapView } from "@/components/MapView";
import { MissionGameplay } from "@/components/MissionGameplay";
import { LocationFolders } from "@/components/LocationFolders";
import { LocationDetail } from "@/components/LocationDetail";
import { PermissionsScreen } from "@/components/PermissionsScreen";
import { BottomNav, type ViewMode } from "@/components/BottomNav";
import { type LocationFolder, getAllFolders } from "@/lib/geolocation";

const Index = () => {
  const [viewMode, setViewMode] = useState<ViewMode>("permissions");
  const [selectedFolder, setSelectedFolder] = useState<LocationFolder | null>(null);

  const handleSelectFolder = (folder: LocationFolder) => {
    setSelectedFolder(folder);
    setViewMode("detail");
  };

  const handleBackToFolders = () => {
    setSelectedFolder(null);
    setViewMode("folders");
  };

  const handleNavigation = (view: ViewMode) => {
    if (view === "ar" || view === "map" || view === "mission") {
      // Check if permissions are granted before navigating to these views
      // For simplicity, we'll navigate directly - permissions screen will show if needed
    }
    setViewMode(view);
  };

  return (
    <div className="min-h-screen pb-16">
      {viewMode === "permissions" && (
        <PermissionsScreen onPermissionsGranted={() => setViewMode("menu")} />
      )}
      {viewMode === "menu" && (
        <MainMenu
          onOpenMap={() => setViewMode("map")}
          onStartMission={() => setViewMode("mission")}
          onCollectNotes={() => setViewMode("ar")}
        />
      )}
      {viewMode === "map" && <MapView onSelectFolder={handleSelectFolder} />}
      {viewMode === "mission" && <MissionGameplay />}
      {viewMode === "ar" && <ARView onViewNotes={() => setViewMode("folders")} />}
      {viewMode === "folders" && (
        <LocationFolders
          onViewInAR={() => setViewMode("ar")}
          onSelectFolder={handleSelectFolder}
        />
      )}
      {viewMode === "detail" && selectedFolder && (
        <LocationDetail
          folder={selectedFolder}
          onBack={handleBackToFolders}
          onUpdate={() => {
            const updated = getAllFolders().find((f) => f.id === selectedFolder.id);
            if (updated) setSelectedFolder(updated);
          }}
        />
      )}

      <BottomNav currentView={viewMode} onNavigate={handleNavigation} />
    </div>
  );
};

export default Index;
