/**
 * Sanitization utilities for analytics IDs interpolated into inline scripts.
 *
 * Any value that is interpolated into a `dangerouslySetInnerHTML` script block
 * MUST be validated here first to prevent XSS (CWE-79).
 */

/**
 * Strips every character that is not alphanumeric, hyphen, or underscore.
 * This is the last line of defence — even if a format-specific regex is
 * accidentally relaxed, this function will neutralise injection payloads.
 */
function sanitizeId(raw: string): string {
    return raw.replace(/[^a-zA-Z0-9_-]/g, "");
}

// Google Analytics 4: G-XXXXXXXXXX  (alphanumeric after prefix)
// Universal Analytics: UA-XXXXXXXX-X
// Google Ads: AW-XXXXXXXXX
// Campaign Manager (DoubleClick): DC-XXXXXXXX
const GA_ID_RE = /^(G|UA|AW|DC)-[A-Za-z0-9-]+$/;

// Google Tag Manager: GTM-XXXXXXX
// Google Tag: GT-XXXXXXX
const GTM_ID_RE = /^(GTM|GT)-[A-Za-z0-9]+$/;

// dataLayer variable names must be valid JS identifiers (letters, digits, _ , $)
const DATA_LAYER_RE = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;

// FullStory org IDs are alphanumeric
const FULLSTORY_ORG_RE = /^[A-Za-z0-9]+$/;

// Intercom app IDs are alphanumeric
const INTERCOM_APP_RE = /^[a-z0-9]+$/i;

// Segment write keys are alphanumeric
const SEGMENT_KEY_RE = /^[A-Za-z0-9]+$/;

export function sanitizeGaId(raw: string): string {
    if (GA_ID_RE.test(raw)) {
        return raw;
    }
    // Fall back to stripping dangerous characters so tracking still works
    // if the format is merely unusual rather than malicious.
    return sanitizeId(raw);
}

export function sanitizeGtmId(raw: string): string {
    if (GTM_ID_RE.test(raw)) {
        return raw;
    }
    return sanitizeId(raw);
}

export function sanitizeDataLayerName(raw: string): string {
    if (DATA_LAYER_RE.test(raw)) {
        return raw;
    }
    return sanitizeId(raw);
}

export function sanitizeFullstoryOrgId(raw: string): string {
    if (FULLSTORY_ORG_RE.test(raw)) {
        return raw;
    }
    return sanitizeId(raw);
}

export function sanitizeIntercomAppId(raw: string): string {
    if (INTERCOM_APP_RE.test(raw)) {
        return raw;
    }
    return sanitizeId(raw);
}

export function sanitizeSegmentWriteKey(raw: string): string {
    if (SEGMENT_KEY_RE.test(raw)) {
        return raw;
    }
    return sanitizeId(raw);
}
