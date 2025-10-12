import { createContext, type Dispatch, type SetStateAction, useContext } from "react";

interface PlaygroundTypeReferenceFormContextValue {
    isNullSelected: boolean;
    setIsNullSelected: Dispatch<SetStateAction<boolean>>;
}

export const PlaygroundTypeReferenceFormContext = createContext<PlaygroundTypeReferenceFormContextValue>({
    isNullSelected: false,
    setIsNullSelected: () => undefined
});

export const usePlaygroundTypeReferenceFormContext = () => {
    return useContext(PlaygroundTypeReferenceFormContext);
};
