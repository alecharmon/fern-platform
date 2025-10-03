export const isSelfServed = () => {
    return process.env.NEXT_PUBLIC_IS_SELF_SERVED === "1";
};
