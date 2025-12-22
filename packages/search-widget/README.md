# @fern-api/search-widget

A standalone search widget with AI-powered search capabilities for documentation sites. This package provides a ready-to-use search modal component that can be embedded in any React application.

## Installation

```bash
npm install @fern-api/search-widget react react-dom
```

Or with pnpm:

```bash
pnpm add @fern-api/search-widget react react-dom
```

## Peer Dependencies

This package requires **React 19 only**:

```json
{
  "react": "^19",
  "react-dom": "^19"
}
```

**All other dependencies are bundled** - including state management (Jotai), data fetching (SWR), and AI SDK libraries. You only need to provide React 19.

## Usage

### Basic Setup

First, import the component and styles in your application:

```jsx
import { SearchModal } from '@fern-api/search-widget';
import '@fern-api/search-widget/styles';
```

Then use the SearchModal component:

```jsx
function App() {
  return (
    <div>
      <SearchModal
        domain="https://your-docs-site.com"
        lang="en"
      >
        🔍 Open Search
      </SearchModal>
    </div>
  );
}
```

### Props

The `SearchModal` component accepts the following props:

#### Required Props

- `domain` (string): The documentation domain to search against (e.g., `"https://buildwithfern.com/learn"`)

#### Optional Props

All standard HTML button props are supported and will be forwarded to the trigger button:

- `lang` (string): Language code for the search interface (e.g., `"en"`). Defaults to `"en"`
- `icon` (React.ReactNode): Icon element to display in the button
- `className`: Additional CSS classes for the button
- `style`: Inline styles for the button
- `onClick`: Additional click handler (runs before opening modal)
- `disabled`: Disable the button
- `children`: Button content (text, icons, etc.)

### Styling the Button

You can style the trigger button in three ways:

#### 1. Inline Styles

```jsx
<SearchModal
  domain="https://docs.example.com"
  lang="en"
  style={{
    padding: '0.75rem 1.5rem',
    fontSize: '1rem',
    background: '#2563eb',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer'
  }}
>
  Search Documentation
</SearchModal>
```

#### 2. CSS Classes

```jsx
<SearchModal
  domain="https://docs.example.com"
  lang="en"
  className="my-search-button"
>
  Search
</SearchModal>
```

```css
.my-search-button {
  padding: 0.75rem 1.5rem;
  background: #2563eb;
  color: white;
  border: none;
  border-radius: 6px;
}
```

#### 3. Using the Default Class

The button has a `fern-search-button` class that you can target:

```css
.fern-search-button {
  padding: 0.75rem 1.5rem;
  background: #2563eb;
  color: white;
}
```

### Complete Example

```jsx
import { SearchModal } from '@fern-api/search-widget';
import '@fern-api/search-widget/styles';

function App() {
  return (
    <div className="app">
      <header>
        <h1>My Documentation</h1>
        <SearchModal
          domain="https://docs.mysite.com"
          lang="en"
          className="search-trigger"
        >
          🔍 Search Docs
        </SearchModal>
      </header>
    </div>
  );
}

export default App;
```

## Features

- **AI-Powered Search**: Natural language search with AI-generated responses
- **Real-time Results**: Fast search results as you type
- **Code Highlighting**: Syntax-highlighted code blocks in search results
- **Keyboard Navigation**: Full keyboard support for navigation
- **Responsive Design**: Works on desktop and mobile devices
- **Customizable Styling**: Style the trigger button to match your design

## Browser Support

- Chrome/Edge (latest 2 versions)
- Firefox (latest 2 versions)
- Safari (latest 2 versions)

## Troubleshooting

### Styles Not Loading

Make sure you import the CSS file:

```jsx
import '@fern-api/search-widget/styles';
```

### Button Not Visible

The button shows "Loading..." while fetching API keys. If it disappears, check:
1. The `domain` prop is a valid documentation site URL
2. Network requests to `${domain}/api/fern-docs/search/api-key` succeed
3. Browser console for any error messages

### Modal Not Opening

Ensure React 19 peer dependencies are installed:

```bash
npm install react@19 react-dom@19
```

If you see module resolution errors, verify that:
- You're using React 19 (not React 18 or earlier)
- Both `react` and `react-dom` are installed at the same version

## What's Bundled

This package bundles all dependencies except React:

**Included in bundle:**
- ✅ State management (`jotai`)
- ✅ Data fetching (`swr`)
- ✅ AI SDK (`@ai-sdk/react`, `ai`)
- ✅ Search UI components
- ✅ All styling (Tailwind CSS + custom SCSS)

**You provide:**
- ⚠️ React 19 and ReactDOM 19

## Bundle Size

- **CSS:** ~652 KiB
- **JavaScript:** ~1.37 MiB (minified)
- **Total:** ~2.03 MiB

The bundle includes code-splitting with 116 lazy-loaded chunks for optimal performance.

## License

Apache-2.0 - See LICENSE file in the package root.

## Support

For issues and questions, please visit the [Fern Platform repository](https://github.com/fern-api/fern-platform).
