/**
 * PostCSS plugin to scope all CSS selectors under the search widget container IDs.
 * This prevents the widget's styles from affecting the host application.
 * 
 * Also includes Radix portal wrappers which render outside the main container
 * but still need the widget's styles applied. The sibling selector targets
 * Radix portals that are appended to body after the dialog.
 */

const WIDGET_SELECTORS = '#fern-search-dialog, #fern-search-dialog-overlay, #fern-search-dialog ~ [data-radix-popper-content-wrapper]';
const WIDGET_DESCENDANT_PREFIX = ':where(#fern-search-dialog, #fern-search-dialog-overlay, #fern-search-dialog ~ [data-radix-popper-content-wrapper])';

const ROOT_SELECTORS = new Set([':root', ':host', 'html', 'body']);

function isRootSelector(selector) {
    const trimmed = selector.trim();
    return ROOT_SELECTORS.has(trimmed);
}

function scopeSelector(selector) {
    const trimmed = selector.trim();
    
    if (isRootSelector(trimmed)) {
        return WIDGET_SELECTORS;
    }
    
    if (trimmed === '*' || trimmed === '::before' || trimmed === '::after') {
        return `${WIDGET_DESCENDANT_PREFIX} ${trimmed}`;
    }
    
    if (trimmed.startsWith('*,') || trimmed.includes(',*,') || trimmed.endsWith(',*')) {
        const parts = trimmed.split(',').map(part => {
            const p = part.trim();
            if (p === '*' || p === '::before' || p === '::after') {
                return `${WIDGET_DESCENDANT_PREFIX} ${p}`;
            }
            if (isRootSelector(p)) {
                return WIDGET_SELECTORS;
            }
            return `${WIDGET_DESCENDANT_PREFIX} ${p}`;
        });
        return parts.join(', ');
    }
    
    if (trimmed.startsWith(':root,') || trimmed.startsWith(':host,')) {
        const parts = trimmed.split(',').map(part => {
            const p = part.trim();
            if (isRootSelector(p)) {
                return WIDGET_SELECTORS;
            }
            return `${WIDGET_DESCENDANT_PREFIX} ${p}`;
        });
        return [...new Set(parts)].join(', ');
    }
    
    if (trimmed.startsWith('@') || trimmed.startsWith(':where(#fern-search-dialog')) {
        return trimmed;
    }
    
    if (trimmed.startsWith('#fern-search-dialog') || trimmed.startsWith('#fern-search-dialog-overlay')) {
        return trimmed;
    }
    
    if (trimmed.startsWith('.dark ') || trimmed.startsWith('.light ')) {
        const spaceIndex = trimmed.indexOf(' ');
        const themeClass = trimmed.substring(0, spaceIndex);
        const rest = trimmed.substring(spaceIndex + 1);
        return `${themeClass} ${WIDGET_DESCENDANT_PREFIX} ${rest}`;
    }
    
    return `${WIDGET_DESCENDANT_PREFIX} ${trimmed}`;
}

function processSelector(selectorStr) {
    if (selectorStr.includes(',')) {
        const parts = [];
        let depth = 0;
        let current = '';
        
        for (let i = 0; i < selectorStr.length; i++) {
            const char = selectorStr[i];
            if (char === '(' || char === '[') {
                depth++;
                current += char;
            } else if (char === ')' || char === ']') {
                depth--;
                current += char;
            } else if (char === ',' && depth === 0) {
                parts.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        if (current.trim()) {
            parts.push(current.trim());
        }
        
        const scopedParts = parts.map(part => scopeSelector(part));
        const uniqueParts = [...new Set(scopedParts)];
        return uniqueParts.join(', ');
    }
    
    return scopeSelector(selectorStr);
}

module.exports = function scopePlugin() {
    return {
        postcssPlugin: 'postcss-fern-search-scope',
        Rule(rule) {
            if (rule.parent && rule.parent.type === 'atrule') {
                const atRuleName = rule.parent.name;
                if (atRuleName === 'keyframes' || atRuleName === '-webkit-keyframes') {
                    return;
                }
            }
            
            const originalSelector = rule.selector;
            
            if (originalSelector.startsWith(':where(#fern-search-dialog')) {
                return;
            }
            
            const newSelector = processSelector(originalSelector);
            
            if (newSelector !== originalSelector) {
                rule.selector = newSelector;
            }
        }
    };
};

module.exports.postcss = true;
