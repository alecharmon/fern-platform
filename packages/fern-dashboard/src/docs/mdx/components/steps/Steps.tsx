import { Button } from "@fern-docs/components/button";
import { cn } from "@fern-docs/components/cn";
import { CirclePlusIcon } from "lucide-react";
import {
    type ComponentProps,
    createContext,
    type ReactElement,
    useCallback,
    useContext,
    useMemo,
    useRef,
    useState
} from "react";
import { useEditorComponentChildren } from "@/components/editor/editor-component";
import { CheckboxControl } from "@/components/editor/editor-component/controls";
import {
    type EditorComponentContextValue,
    useEditorComponent
} from "@/components/editor/editor-component/EditorComponentContext";
import {
    EditorComponentPopoverButton,
    EditorComponentPopoverProvider
} from "@/components/editor/editor-component/EditorComponentPopover";

const EMPTY_STEP_CONTENT = `
<Step title="Title">
  Content
</Step>
`;

export const EMPTY_STEPS_CONTENT = `
<Steps>
  <Step title="First Step">
    Content for first step
  </Step>
  <Step title="Second Step">
    Content for second step
  </Step>
</Steps>
`;

interface StepData {
    id: string;
    title?: string;
    // EditorComponent values passed from Step to StepGroup
    editorComponentValues?: EditorComponentContextValue;
}

interface StepsContextType {
    registerStep: (step: StepData) => void;
    unregisterStep: (id: string) => void;
    getStepIndex: (id: string) => number;
    steps: StepData[];
}

export const StepsContext = createContext<StepsContextType | undefined>(undefined);

export function useStepsContext() {
    const context = useContext(StepsContext);
    if (!context) {
        throw new Error("Step must be used within a StepGroup");
    }
    return context;
}

interface StepGroupProps extends ComponentProps<"div"> {
    toc?: boolean;
}

export function StepGroup({ children, className, toc = false, ...props }: StepGroupProps): ReactElement<any> {
    const [steps, setSteps] = useState<StepData[]>([]);
    const { isWithinEditor } = useEditorComponent();
    const { appendChildrenMdx } = useEditorComponentChildren();
    const stepGroupRef = useRef<HTMLDivElement>(null);

    const registerStep = useCallback((step: StepData) => {
        setSteps((prevSteps) => {
            // Check if step already exists
            const existingIndex = prevSteps.findIndex((s) => s.id === step.id);
            if (existingIndex >= 0) {
                // Update existing step
                const newSteps = [...prevSteps];
                newSteps[existingIndex] = step;
                return newSteps;
            }
            // Add new step
            return [...prevSteps, step];
        });
    }, []);

    const unregisterStep = useCallback((id: string) => {
        setSteps((prevSteps) => prevSteps.filter((step) => step.id !== id));
    }, []);

    const getStepIndex = useCallback(
        (id: string) => {
            const sortedSteps = [...steps].sort((a, b) => {
                // Use the editor component index if available, otherwise fall back to registration order
                const aIndex = a.editorComponentValues?.index || 0;
                const bIndex = b.editorComponentValues?.index || 0;
                return aIndex - bIndex;
            });
            const index = sortedSteps.findIndex((step) => step.id === id);
            return index >= 0 ? index + 1 : 0;
        },
        [steps]
    );

    const contextValue = useMemo(
        () => ({
            registerStep,
            unregisterStep,
            getStepIndex,
            steps
        }),
        [registerStep, unregisterStep, getStepIndex, steps]
    );

    const stepGroupContent = (
        <div ref={stepGroupRef} className={cn("fern-steps relative", className)} data-toc={toc} {...props}>
            {children}
            {isWithinEditor && (
                <Button
                    variant="ghost"
                    className="border-border-default w-full rounded border border-dashed p-1"
                    onClick={() => {
                        appendChildrenMdx(EMPTY_STEP_CONTENT);
                    }}
                >
                    <CirclePlusIcon />
                    Add step
                </Button>
            )}
        </div>
    );

    if (isWithinEditor) {
        return (
            <StepsContext.Provider value={contextValue}>
                <EditorComponentPopoverProvider
                    attributes={{
                        toc: new CheckboxControl({
                            defaultValue: toc,
                            label: "Show in table of contents"
                        })
                    }}
                    targetRef={stepGroupRef}
                    hoverSlopThreshold={50}
                    openPopoverIfNewlyCreated={false}
                >
                    <div className="relative">
                        <EditorComponentPopoverButton className="absolute -right-8 -top-2" componentName="Steps" />
                        {stepGroupContent}
                    </div>
                </EditorComponentPopoverProvider>
            </StepsContext.Provider>
        );
    }

    return <StepsContext.Provider value={contextValue}>{stepGroupContent}</StepsContext.Provider>;
}
