export declare namespace NavbarSectionTitle {
    export interface Props {
        title: string;
    }
}

export const NavbarSectionTitle = ({ title }: NavbarSectionTitle.Props) => {
    return <div className="my-3 hidden text-xs font-bold md:flex">{title}</div>;
};
