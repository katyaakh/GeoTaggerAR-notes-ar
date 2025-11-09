import { ArrowLeft, Edit, MapPin, Calendar, Trash2, Plus, Satellite } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  type LocationFolder,
  deleteNote,
  renameFolder,
  addNoteToFolder,
  updateFolderSatelliteData,
  getAllFolders,
} from "@/lib/geolocation";
import { toast } from "sonner";
import { useState } from "react";
import { SatelliteOverlay } from "./SatelliteOverlay";
import { WeatherForecast } from "./WeatherForecast";

interface LocationDetailProps {
  folder: LocationFolder;
  onBack: () => void;
  onUpdate: () => void;
}

export const LocationDetail = ({ folder: initialFolder, onBack, onUpdate }: LocationDetailProps) => {
  const [folder, setFolder] = useState(initialFolder);
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState(folder.name);
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [isLoadingSatellite, setIsLoadingSatellite] = useState(false);

  const refreshFolder = () => {
    const folders = getAllFolders();
    const updated = folders.find((f) => f.id === folder.id);
    if (updated) {
      setFolder(updated);
      onUpdate();
    }
  };

  const handleRename = () => {
    if (newName.trim()) {
      renameFolder(folder.id, newName.trim());
      setIsEditingName(false);
      toast.success("Folder renamed");
      refreshFolder();
    }
  };

  const handleAddNote = () => {
    if (newNote.trim()) {
      addNoteToFolder(folder.id, newNote.trim());
      setNewNote("");
      setIsAddingNote(false);
      toast.success("Note added");
      refreshFolder();
    }
  };

  const handleDeleteNote = (noteId: string) => {
    deleteNote(folder.id, noteId);
    toast.success("Note deleted");
    refreshFolder();
  };

  const handleFetchSatellite = async () => {
    setIsLoadingSatellite(true);
    try {
      await updateFolderSatelliteData(folder.id);
      toast.success("Satellite data updated");
      refreshFolder();
    } catch (error) {
      toast.error("Failed to fetch satellite data");
    } finally {
      setIsLoadingSatellite(false);
    }
  };

  const openInMaps = () => {
    const url = `https://www.google.com/maps?q=${folder.coordinates.latitude},${folder.coordinates.longitude}`;
    window.open(url, "_blank");
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto space-y-4">
        <Button variant="ghost" onClick={onBack} className="gap-2 mb-4">
          <ArrowLeft className="h-4 w-4" />
          Back to Folders
        </Button>

        {/* Folder Header */}
        <Card className="p-6">
          <div className="space-y-4">
            {isEditingName ? (
              <div className="flex gap-2">
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Folder name"
                  onKeyDown={(e) => e.key === "Enter" && handleRename()}
                />
                <Button onClick={handleRename}>Save</Button>
                <Button variant="outline" onClick={() => setIsEditingName(false)}>
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">{folder.name}</h1>
                <Button variant="outline" size="icon" onClick={() => setIsEditingName(true)}>
                  <Edit className="h-4 w-4" />
                </Button>
              </div>
            )}

            <div className="text-sm text-muted-foreground space-y-1">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                <span>
                  {folder.coordinates.latitude.toFixed(6)}, {folder.coordinates.longitude.toFixed(6)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span>Created {new Date(folder.createdAt).toLocaleString()}</span>
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={openInMaps} variant="outline" size="sm">
                View on Map
              </Button>
              <Button
                onClick={handleFetchSatellite}
                variant="outline"
                size="sm"
                className="gap-2"
                disabled={isLoadingSatellite}
              >
                <Satellite className="h-4 w-4" />
                {isLoadingSatellite ? "Fetching..." : "Get Satellite Data"}
              </Button>
            </div>
          </div>
        </Card>

        {/* Satellite Data */}
        {folder.satelliteData && <SatelliteOverlay data={folder.satelliteData} />}

        {/* Weather Forecast */}
        <WeatherForecast 
          latitude={folder.coordinates.latitude} 
          longitude={folder.coordinates.longitude} 
        />

        {/* Add Note */}
        <Card className="p-4">
          {isAddingNote ? (
            <div className="space-y-3">
              <Textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="What would you like to note about this location?"
                className="min-h-[100px]"
              />
              <div className="flex gap-2">
                <Button onClick={handleAddNote} className="flex-1">
                  Save Note
                </Button>
                <Button variant="outline" onClick={() => setIsAddingNote(false)} className="flex-1">
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button onClick={() => setIsAddingNote(true)} className="w-full gap-2">
              <Plus className="h-4 w-4" />
              Add Another Note
            </Button>
          )}
        </Card>

        {/* Notes List */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Notes History ({folder.notes.length})
          </h2>

          {folder.notes.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">No notes yet at this location</p>
            </Card>
          ) : (
            folder.notes
              .sort((a, b) => b.createdAt - a.createdAt)
              .map((note) => (
                <Card key={note.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <MapPin className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium mb-2">{note.note}</p>
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <span>{new Date(note.createdAt).toLocaleString()}</span>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteNote(note.id)}
                        className="mt-2"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))
          )}
        </div>
      </div>
    </div>
  );
};
