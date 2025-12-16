import type { LibraryDefinition, MemberDefinition, ModuleDefinition } from "../ir/types";

export interface GeneratedPage {
    pageId: string;
    title: string;
    slug: string;
    content: string;
}

/**
 * Stub MarkdownGenerator - generates minimal placeholder pages from IR.
 */
export class MarkdownGeneratorStub {
    generateFromLibrary(library: LibraryDefinition, baseSlug: string): GeneratedPage[] {
        const pages: GeneratedPage[] = [];

        // Overview page
        pages.push({
            pageId: `${baseSlug}-overview`,
            title: library.name,
            slug: baseSlug,
            content: this.renderOverview(library)
        });

        // Module pages
        for (const module of library.modules) {
            pages.push(...this.generateModulePages(module, baseSlug));
        }

        return pages;
    }

    private renderOverview(library: LibraryDefinition): string {
        const moduleList = library.modules.map((m) => `- ${m.name}`).join("\n");
        return `# ${library.name}

> Placeholder documentation. Real content coming soon.

**Language:** ${library.language}
**Source:** ${library.metadata.sourceUrl}

## Modules

${moduleList}
`;
    }

    private generateModulePages(module: ModuleDefinition, baseSlug: string): GeneratedPage[] {
        const pages: GeneratedPage[] = [];
        const moduleSlug = `${baseSlug}/${module.name}`;

        pages.push({
            pageId: moduleSlug,
            title: module.name,
            slug: moduleSlug,
            content: this.renderModule(module)
        });

        // Pages for classes
        for (const member of module.members) {
            if (member.kind === "class") {
                const classSlug = `${moduleSlug}/${member.name.toLowerCase()}`;
                pages.push({
                    pageId: classSlug,
                    title: member.name,
                    slug: classSlug,
                    content: this.renderClass(member)
                });
            }
        }

        return pages;
    }

    private renderModule(module: ModuleDefinition): string {
        const members = module.members
            .map((m) => `- **${m.name}** (${m.kind})${m.docstring ? ` - ${m.docstring}` : ""}`)
            .join("\n");

        return `# ${module.name}

${module.docstring ?? ""}

## Members

${members || "No members."}
`;
    }

    private renderClass(cls: MemberDefinition): string {
        const methods = (cls.members ?? [])
            .map((m) => `- **${m.name}**${m.docstring ? ` - ${m.docstring}` : ""}`)
            .join("\n");

        return `# ${cls.name}

${cls.docstring ?? ""}

## Methods

${methods || "No methods."}
`;
    }
}
