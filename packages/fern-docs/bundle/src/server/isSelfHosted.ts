export const isSelfHosted = () => {
    return process.env.NEXT_PUBLIC_IS_SELF_HOSTED === "1";
};
