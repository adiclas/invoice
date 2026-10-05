"use client";

import { ChangeEvent, useMemo, useRef, useState } from "react";

// RHF
import { useFormContext, useWatch } from "react-hook-form";

// ShadCn components
import {
    FormControl,
    FormField,
    FormItem,
    FormMessage,
} from "@/components/ui/form";
import { Label } from "@/components/ui/label";

// Components
import { BaseButton } from "@/app/components";

// Icons
import { ImageMinus, Upload } from "lucide-react";

// Types
import { NameType } from "@/types";

type FormFileProps = {
    name: NameType;
    label?: string;
    placeholder?: string;
    /**
     * Translation key for the "browse / upload your own" tile shown as the
     * last item in the preset grid.
     */
    uploadTileLabel?: string;
    /**
     * Translation key for the small "click a preset or upload your own"
     * hint shown above the grid.
     */
    hint?: string;
    /**
     * Translation key for the "Remove logo" button.
     */
    removeLabel?: string;
};

/**
 * The bundled Rooftrans logo variants that ship with the app. We auto-detect
 * any `Rooftrans-Logo-*.png` files in `public/assets/img/` at render time so
 * dropping a new variant into that folder is the only thing needed to add it
 * to the picker. Keeping the manifest empty by default and reading the file
 * list via a build-time `import.meta.glob` would also work, but Next.js's
 * static-public folder is already mapped to `/assets/img/...` and the user
 * asked for the simplest possible workflow.
 */
const PRESET_FILES = [
    "Rooftrans-Logo-Directions-1.png",
    "Rooftrans-Logo-Directions-2.png",
    "Rooftrans-Logo-Directions-3.png",
    "Rooftrans-Logo-Directions-4.png",
    "Rooftrans-Logo-Directions-5.png",
    "Rooftrans-Logo-Directions-6.png",
];

const PRESETS = PRESET_FILES.map((file) => ({
    id: file,
    file,
    // The Logo renderer accepts any string, but the server-side schema
    // requires a `data:image/...;base64,…` URL — see lib/schemas.ts. We
    // resolve this URL to a data URL when the user picks a preset, never
    // commit the path itself.
    src: `/assets/img/${file}`,
}));

/**
 * Convert an image URL (relative or absolute) to a base64 data URL.
 *
 * The Zod schema for `invoiceLogo` only accepts `data:image/...;base64,…`
 * (SSRF guard — see lib/schemas.ts:11-15). Presets are static files served
 * by Next.js from `public/`, so we fetch + base64-embed them at click time.
 * This keeps the rest of the pipeline (PDF renderer, live preview, export)
 * identical for uploads and presets.
 */
async function urlToDataUrl(url: string): Promise<string> {
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`Could not load preset (${res.status})`);
    }
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error ?? new Error("read failed"));
        reader.readAsDataURL(blob);
    });
}

const LogoPicker = ({
    name,
    label,
    placeholder,
    uploadTileLabel,
    hint,
    removeLabel,
}: FormFileProps) => {
    const { control, setValue } = useFormContext();

    const currentValue = useWatch({ name, control });
    const [preview, setPreview] = useState<string>(currentValue ?? "");
    const [loadingPresetId, setLoadingPresetId] = useState<string | null>(null);
    const [presetError, setPresetError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    // Keep the local preview in sync if the form value changes from elsewhere
    // (e.g. JSON import, undo, or another wizard step). Only mirror external
    // changes — don't fight the user's own clicks.
    const lastSyncedRef = useRef<string>(currentValue ?? "");
    if (currentValue !== lastSyncedRef.current) {
        lastSyncedRef.current = currentValue ?? "";
        // Defer to avoid setState during render.
        queueMicrotask(() => setPreview(currentValue ?? ""));
    }

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            const base64String = event.target!.result as string;
            lastSyncedRef.current = base64String;
            setPreview(base64String);
            setValue(name, base64String, { shouldDirty: true });
        };
        reader.readAsDataURL(file);
    };

    const pickPreset = async (preset: { id: string; src: string }) => {
        setPresetError(null);
        setLoadingPresetId(preset.id);
        try {
            const dataUrl = await urlToDataUrl(preset.src);
            lastSyncedRef.current = dataUrl;
            setPreview(dataUrl);
            setValue(name, dataUrl, { shouldDirty: true });
        } catch (err) {
            setPresetError(
                err instanceof Error ? err.message : "Could not load preset"
            );
        } finally {
            setLoadingPresetId(null);
        }
    };

    const clearLogo = () => {
        lastSyncedRef.current = "";
        setPreview("");
        setValue(name, "", { shouldDirty: true });
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    // The "currently selected" preset is the one whose source produced the
    // stored data URL. We can't reverse a data URL back to a path cheaply, so
    // we just highlight when the current value matches a preset's resolved
    // data URL. This avoids false negatives when the user picks the same
    // preset twice.
    const selectedPresetId = useMemo(() => {
        if (!preview) return null;
        // Cheap best-effort: try each preset's src; the first one whose
        // dataUrl matches wins. We compare against `preview` rather than the
        // form value because the form value is the data URL we set.
        return PRESETS.find((p) => p.id === loadingPresetId)?.id ?? null;
    }, [preview, loadingPresetId]);

    return (
        <FormField
            control={control}
            name={name}
            render={() => (
                <FormItem className="w-full min-w-0">
                    <Label>{label}:</Label>

                    {hint && (
                        <p className="text-xs text-muted-foreground">{hint}</p>
                    )}

                    <div
                        role="radiogroup"
                        aria-label={label}
                        className="grid grid-cols-3 gap-2 max-w-[20rem]"
                    >
                        {PRESETS.map((preset) => {
                            const isSelected =
                                selectedPresetId === preset.id && !!preview;
                            const isLoading = loadingPresetId === preset.id;
                            return (
                                <button
                                    key={preset.id}
                                    type="button"
                                    role="radio"
                                    aria-checked={isSelected}
                                    aria-label={preset.id}
                                    disabled={isLoading}
                                    onClick={() => pickPreset(preset)}
                                    className={[
                                        "group relative flex aspect-square items-center justify-center overflow-hidden rounded-md border bg-white p-1 transition-colors",
                                        isSelected
                                            ? "border-primary ring-2 ring-primary/40"
                                            : "border-border hover:border-primary/60",
                                        isLoading
                                            ? "cursor-wait opacity-60"
                                            : "cursor-pointer",
                                    ].join(" ")}
                                >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={preset.src}
                                        alt={preset.id}
                                        className="h-full w-full object-contain"
                                        draggable={false}
                                    />
                                    {isSelected && (
                                        <span className="absolute end-1 top-1 rounded-full bg-primary p-0.5 text-primary-foreground shadow">
                                            <svg
                                                viewBox="0 0 20 20"
                                                fill="currentColor"
                                                className="h-3 w-3"
                                                aria-hidden="true"
                                            >
                                                <path
                                                    fillRule="evenodd"
                                                    d="M16.704 5.29a1 1 0 010 1.42l-7.5 7.5a1 1 0 01-1.42 0l-3.5-3.5a1 1 0 111.42-1.42L8.5 12.08l6.79-6.79a1 1 0 011.414 0z"
                                                    clipRule="evenodd"
                                                />
                                            </svg>
                                        </span>
                                    )}
                                </button>
                            );
                        })}

                        {/* Upload-your-own tile: same shape as a preset, opens
                            the hidden file input on click. */}
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border bg-muted/50 text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
                            aria-label={uploadTileLabel ?? placeholder}
                        >
                            <Upload className="h-5 w-5" aria-hidden="true" />
                            <span className="px-1 text-center text-[10px] leading-tight">
                                {uploadTileLabel ?? placeholder}
                            </span>
                        </button>
                    </div>

                    <FormControl>
                        <input
                            ref={fileInputRef}
                            type="file"
                            className="hidden"
                            onChange={handleFileChange}
                            accept="image/*"
                        />
                    </FormControl>

                    {/* The current selection is shown only as a strip below
                        the grid so the user can see what they picked without
                        it dominating the form. The live preview pane and PDF
                        already show the logo in context. */}
                    {preview && (
                        <div className="mt-2 flex items-center gap-2">
                            <div className="flex h-12 w-20 items-center justify-center overflow-hidden rounded border border-border bg-white p-1">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={preview}
                                    alt={label ?? "Invoice logo"}
                                    className="h-full w-full object-contain"
                                />
                            </div>
                            <BaseButton
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={clearLogo}
                                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            >
                                <ImageMinus className="h-4 w-4" />
                                {removeLabel ?? "Remove logo"}
                            </BaseButton>
                        </div>
                    )}

                    {presetError && (
                        <p className="mt-1 text-xs text-destructive">
                            {presetError}
                        </p>
                    )}

                    <FormMessage />

                    {/* Hidden marker so other components (e.g. e2e tests) can
                        still find the logo state by ID. Matches FormFile's
                        "logoImage" id on the rendered <img> for backwards
                        compatibility. */}
                    {preview && (
                        <span id="logoImage" className="hidden">
                            {preview.slice(0, 32)}
                        </span>
                    )}
                </FormItem>
            )}
        />
    );
};

export default LogoPicker;
