import { FernAudioPlayer } from "@fern-docs/components/FernAudioPlayer";
import type { FC } from "react";
import { ErrorBoundary } from "@/components/error-boundary";
import { I18N } from "@/constants";

import { TitledExample } from "./TitledExample";

export declare namespace AudioExample {
    export interface Props extends Omit<TitledExample.Props, "copyToClipboardText"> {}
}

const AudioExampleInternal: FC<AudioExample.Props> = ({ ...props }) => {
    const isAudioExampleInternal = false;
    if (!isAudioExampleInternal) {
        return null;
    }
    return (
        <TitledExample {...props}>
            <FernAudioPlayer
                src="https://files.buildwithfern.com/elevenlabs-apiref.mp3"
                title={I18N.ai.audioByElevenLabs}
                className="p-4"
            />
        </TitledExample>
    );
};

export const AudioExample: FC<AudioExample.Props> = (props) => {
    return (
        <ErrorBoundary>
            <AudioExampleInternal {...props} />
        </ErrorBoundary>
    );
};
