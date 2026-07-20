import { useRef, useState } from "react";
import { Check, Loader2, Pencil, X } from "lucide-react";
import { useFrappeFileUpload, useFrappePostCall } from "frappe-react-sdk";
import {
  updateCurrentProfile,
  useCurrentProfile,
} from "@/hooks/useCurrentProfile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const UPDATE_PROFILE = "cs17_portal.api.update_my_profile";

export default function FacultyProfileCard() {
  const { profile } = useCurrentProfile();
  const fileInput = useRef<HTMLInputElement>(null);
  const [editingName, setEditingName] = useState(false);
  const [firstName, setFirstName] = useState(profile?.first_name ?? "");
  const [lastName, setLastName] = useState(profile?.last_name ?? "");
  const [error, setError] = useState<string | null>(null);
  const { upload, loading: uploading } = useFrappeFileUpload();
  const { call, loading: saving } = useFrappePostCall(UPDATE_PROFILE);

  async function save(patch: { first_name?: string; last_name?: string; profile_picture?: string }) {
    setError(null);
    const payload = {
      first_name: patch.first_name ?? profile?.first_name ?? "",
      last_name: patch.last_name ?? profile?.last_name ?? "",
      profile_picture: patch.profile_picture ?? profile?.profile_picture ?? "",
    };
    try {
      const saved = await call(payload);
      updateCurrentProfile({ ...payload, full_name: saved.message.full_name });
      return true;
    } catch (err: any) {
      setError(err?.message ?? "Could not save your profile. Please try again.");
      return false;
    }
  }

  async function handlePhotoChange(file: File | null) {
    if (!file) return;
    setError(null);
    if (!file.type.startsWith("image/")) {
      setError("Choose an image file.");
      return;
    }
    try {
      const uploaded = await upload(file, { isPrivate: false });
      await save({ profile_picture: uploaded.file_url });
    } catch (err: any) {
      setError(err?.message ?? "Could not upload the photo. Please try again.");
    }
  }

  function startEditingName() {
    setFirstName(profile?.first_name ?? "");
    setLastName(profile?.last_name ?? "");
    setEditingName(true);
  }

  async function saveName() {
    if (!firstName.trim() || !lastName.trim()) {
      setError("First and last name are both required.");
      return;
    }
    const saved = await save({
      first_name: firstName.trim(),
      last_name: lastName.trim(),
    });
    if (saved) setEditingName(false);
  }

  const busy = uploading || saving;

  return (
    <div className="border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-4">
        <div className="relative group shrink-0">
          {profile?.profile_picture ? (
            <img
              src={profile.profile_picture}
              alt="Profile photo"
              className="w-12 h-12 rounded-full object-cover"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-lg font-semibold">
              {profile?.full_name?.[0] ?? "?"}
            </div>
          )}
          <button
            type="button"
            aria-label={profile?.profile_picture ? "Change photo" : "Upload photo"}
            onClick={() => fileInput.current?.click()}
            disabled={busy}
            className="absolute inset-0 rounded-full cursor-pointer opacity-0 group-hover:opacity-100 bg-black/40 text-white flex items-center justify-center transition-opacity"
          >
            <Pencil className="size-4" />
          </button>
          {profile?.profile_picture && (
            <button
              type="button"
              aria-label="Remove photo"
              onClick={() => save({ profile_picture: "" })}
              disabled={busy}
              className="absolute -top-1 -right-1 size-4 rounded-full bg-background border border-border text-muted-foreground opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
            >
              <X className="size-3" />
            </button>
          )}
          {uploading && (
            <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
              <Loader2 className="size-4 text-white animate-spin" />
            </div>
          )}
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => handlePhotoChange(event.target.files?.[0] ?? null)}
          />
        </div>

        {editingName ? (
          <div className="flex items-center gap-2">
            <Input
              aria-label="First name"
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              className="h-8 w-28"
            />
            <Input
              aria-label="Last name"
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              className="h-8 w-28"
            />
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Save name"
              onClick={saveName}
              disabled={busy}
            >
              <Check className="size-3.5" />
            </Button>
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-1">
              <p className="text-sm font-medium">{profile?.full_name ?? "—"}</p>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="Edit name"
                onClick={startEditingName}
              >
                <Pencil className="size-3" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Faculty</p>
          </div>
        )}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
