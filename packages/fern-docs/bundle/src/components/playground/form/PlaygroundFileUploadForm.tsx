"use client";

import { cn } from "@fern-docs/components/cn";
import { FernButton, FernButtonGroup } from "@fern-docs/components/FernButton";
import { FernCard } from "@fern-docs/components/FernCard";
import { t } from "@fern-docs/i18n";
import { File, FilePlus, Mic, X } from "lucide-react";
import prettyBytes from "pretty-bytes";
import { type ChangeEvent, type DragEventHandler, memo, useEffect, useRef, useState } from "react";
import { useAudioRecorder } from "../hooks/useAudioRecorder";
import { isValidFile, uniqueFiles } from "../utils/utils";
import { WithLabelInternal } from "../WithLabel";
import { PlaygroundAudioControls } from "./PlaygroundAudioControls";
import { WaveformAnimation } from "./PlaygroundWaveformAnimation";

export interface PlaygroundFileUploadFormProps {
    id: string;
    propertyKey: string;
    type: "file" | "files";
    isOptional?: boolean;
    onValueChange: (value: readonly File[] | undefined) => void;
    value: readonly File[] | undefined;
    allowAudioRecording?: boolean;
    lang: string;
}

export const PlaygroundFileUploadForm = memo<PlaygroundFileUploadFormProps>(
    ({ id, propertyKey, type, isOptional, onValueChange, value, allowAudioRecording = true, lang }) => {
        // Remove invalid files
        // biome-ignore lint/correctness/useExhaustiveDependencies: only run when value changes
        useEffect(() => {
            if (value != null) {
                const hasInvalidFiles = value.some((f) => !isValidFile(f));
                if (hasInvalidFiles) {
                    // force a re-render to clear the invalid files
                    setTimeout(() => {
                        onValueChange(undefined);
                    }, 0);
                }
            }
        }, [value]);

        const [drag, setDrag] = useState(false);
        const ref = useRef<HTMLInputElement>(null);
        const [{ isRecording, elapsedTime, volume, audioUrl, isSupported }, { startRecording, stopRecording }] =
            useAudioRecorder(({ file }) => onValueChange([file]));

        const canRecordAudio = isSupported && allowAudioRecording;

        const dragOver: DragEventHandler = (e) => {
            e.preventDefault();
            setDrag(true);
        };

        const dragEnter: DragEventHandler = (e) => {
            e.preventDefault();
            setDrag(true);
        };

        const dragLeave: DragEventHandler = (e) => {
            e.preventDefault();
            setDrag(false);
        };

        const fileDrop: DragEventHandler = (e) => {
            e.preventDefault();
            setDrag(false);
            const files = Array.from(e.dataTransfer.files);
            onValueChange(files);
        };

        const handleChangeFiles = (files: FileList | null | undefined) => {
            const filesArray = files != null ? Array.from(files) : [];
            if (type === "files") {
                // append files
                onValueChange(uniqueFiles([...(value ?? []), ...filesArray]));
                return;
            } else {
                // replace files
                onValueChange(filesArray.length > 0 ? filesArray : undefined);
            }
        };

        const handleRemove = () => {
            onValueChange(undefined);
        };

        const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
            const files = e.target.files;
            if (files != null) {
                handleChangeFiles(files);
            }

            // Clear input value to allow selecting same file again
            if (ref.current != null) {
                ref.current.value = "";
            }
        };

        return (
            <WithLabelInternal
                propertyKey={propertyKey}
                value={value}
                onRemove={handleRemove}
                isRequired={!isOptional}
                typeShorthand={type === "file" ? "file" : "multiple files"}
                availability={undefined}
                description={undefined}
                onChange={() => {
                    void 0;
                }}
            >
                <input
                    ref={ref}
                    id={id}
                    type="file"
                    accept={"*"} //
                    multiple={type === "files"}
                    onChange={handleFileChange}
                    className="hidden"
                />
                <FernCard
                    className={cn("rounded-2 w-full", {
                        elevated: drag
                    })}
                    onDragOver={dragOver}
                    onDragEnter={dragEnter}
                    onDragLeave={dragLeave}
                    onDrop={fileDrop}
                >
                    {isRecording ? (
                        <div className="flex items-center gap-4 p-4">
                            <div className="flex-1">
                                <div className="flex items-center gap-3 p-2">
                                    <div className="h-3 w-full">
                                        <WaveformAnimation volume={volume} />
                                    </div>
                                    <span className="font-mono text-sm">
                                        {Math.floor(elapsedTime / 60)
                                            .toString()
                                            .padStart(2, "0")}
                                        :{(elapsedTime % 60).toString().padStart(2, "0")}
                                    </span>
                                </div>
                            </div>
                            <FernButton
                                icon={isRecording ? <Mic className="animate-pulse" /> : <Mic />}
                                variant="minimal"
                                intent={isRecording ? "danger" : "primary"}
                                onClick={isRecording ? stopRecording : startRecording}
                            />
                        </div>
                    ) : value == null || value.length === 0 ? (
                        <div className="flex flex-col items-center gap-3 p-6">
                            <h5>{`Drop file${type === "files" ? "s" : ""} here to upload`}</h5>
                            <div className="flex gap-2">
                                <FernButton
                                    onClick={() => ref.current?.click()}
                                    text={t(lang).buttons.browseFiles}
                                    rounded
                                    variant="outlined"
                                    intent="primary"
                                />
                                {canRecordAudio && (
                                    <FernButton
                                        onClick={() => void startRecording()}
                                        icon={<Mic />}
                                        rounded
                                        variant="outlined"
                                        intent="primary"
                                    />
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="divide-border-default divide-y">
                            {value.map((file) =>
                                isValidFile(file) ? (
                                    <div key={file.name} className="flex justify-between px-4 py-2">
                                        <div className="flex min-w-0 shrink items-center gap-2">
                                            <div className="p-1">
                                                <File />
                                            </div>
                                            <span className="inline-flex min-w-0 shrink items-baseline gap-2">
                                                <span className="truncate text-sm">{file.name}</span>
                                                <span className="text-(color:--grayscale-a11) text-xs">
                                                    ({prettyBytes(file.size)})
                                                </span>
                                            </span>
                                        </div>
                                        <FernButtonGroup className="-mr-2">
                                            {audioUrl && <PlaygroundAudioControls audioUrl={audioUrl} />}
                                            {!audioUrl && (
                                                <FernButton
                                                    text={t(lang).buttons.change}
                                                    onClick={() => ref.current?.click()}
                                                    size="small"
                                                    variant="minimal"
                                                />
                                            )}
                                            {canRecordAudio && (
                                                <FernButton
                                                    icon={<Mic />}
                                                    onClick={() => void startRecording()}
                                                    size="small"
                                                    variant="minimal"
                                                />
                                            )}
                                            <FernButton
                                                icon={<X />}
                                                size="small"
                                                variant="minimal"
                                                onClick={() => {
                                                    onValueChange(value.filter((f) => f !== file));
                                                    if (ref.current != null) {
                                                        ref.current.value = "";
                                                    }
                                                }}
                                            />
                                        </FernButtonGroup>
                                    </div>
                                ) : null
                            )}
                            {type === "files" && (
                                // TODO: allow multiple recordings
                                <div className="flex justify-end p-4">
                                    <FernButton
                                        onClick={() => ref.current?.click()}
                                        icon={<FilePlus />}
                                        text={t(lang).buttons.addMoreFiles}
                                        rounded
                                        variant="outlined"
                                        intent="primary"
                                    />
                                </div>
                            )}
                        </div>
                    )}
                </FernCard>
            </WithLabelInternal>
        );
    }
);

PlaygroundFileUploadForm.displayName = "PlaygroundFileUploadForm";
