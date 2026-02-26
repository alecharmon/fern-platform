import * as prisma from "@prisma/client";

import { ReleaseType } from "../../controllers/generators/types";

export { getPrereleaseType, getPrereleaseTypeAndVersion, parseSemverOrThrow } from "./semverUtils";

export function convertGeneratorReleaseType(releaseType: ReleaseType): prisma.ReleaseType {
    switch (releaseType) {
        case ReleaseType.Ga:
            return prisma.ReleaseType.ga;
        case ReleaseType.Rc:
            return prisma.ReleaseType.rc;
    }
}

export function convertPrismaReleaseType(releaseType: prisma.ReleaseType): ReleaseType {
    switch (releaseType) {
        case prisma.ReleaseType.ga:
            return ReleaseType.Ga;
        case prisma.ReleaseType.rc:
            return ReleaseType.Rc;
    }
}
