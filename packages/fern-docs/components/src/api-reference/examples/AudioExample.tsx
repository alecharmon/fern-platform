"use client";

import { t } from "@fern-docs/i18n";
import type { FC } from "react";
import { FernAudioPlayer } from "../../FernAudioPlayer";
import { useErrorBoundary } from "../../providers/ErrorBoundaryProvider";
import { TitledExample } from "./TitledExample";

export declare namespace AudioExample {
    export interface Props extends Omit<TitledExample.Props, "copyToClipboardText"> {
        lang: string;
    }
}

const AudioExampleInternal: FC<AudioExample.Props> = ({ lang, ...props }) => {
    const isAudioExampleInternal = false;
    if (!isAudioExampleInternal) {
        return null;
    }
    return (
        <TitledExample {...props} lang={lang}>
            <FernAudioPlayer
                src="https://files.buildwithfern.com/elevenlabs-apiref.mp3"
                title={t(lang).ai.audioByElevenLabs}
                className="p-4"
            />
        </TitledExample>
    );
};

export const AudioExample: FC<AudioExample.Props> = (props) => {
    const ErrorBoundary = useErrorBoundary();
    return (
        <ErrorBoundary>
            <AudioExampleInternal {...props} />
        </ErrorBoundary>
    );
};
