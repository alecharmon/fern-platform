# SplitLayout Component

A reusable layout component for auth pages with a white card on the left and background content on the right, featuring smooth animations.

## Components

### 1. **SplitLayout** (Base Component)
The core layout component that handles the visual layout and animations.

**Props:**
- `cardContent` - Content to render in the white card
- `backgroundContent` - Content to render in the background section
- `overlay` - Optional overlay content (logo, buttons, etc.)
- `centerCard` - Boolean to trigger center animation
- `cardClassName` - Custom className for card
- `backgroundClassName` - Custom className for background
- `animationDuration` - Animation duration in ms (default: 500)

**Behavior:**
- **Default state**: Card on left (40% width), background visible on right
- **Centered state**: Card animates to center (60% width), background fades out
- **Mobile**: Full width card, no background section

### 2. **AuthLayoutClient** (Route-Based Wrapper)
Client component that automatically handles route-based animations.

**Features:**
- Automatically centers card when route is `/get-started`
- Keeps card left-aligned on `/login`
- Smooth animation on route transitions
- Uses Next.js `usePathname()` hook

**Props:**
- All props from `SplitLayout`
- `forceCenter` - Override automatic route-based centering

### 3. **GetStartedLayout** (Get-Started Wrapper)
Pre-configured layout for the get-started page.

**Features:**
- Uses same branding/background as login page
- Automatically centered via `AuthLayoutClient`
- Wraps children in the card content

## Usage

### Login Page
```tsx
import { AuthLayoutClient } from "../layout/AuthLayoutClient";

export const LoginPage = () => {
    const cardContent = <LoginForm />;
    const backgroundContent = <BrandingSection />;
    const overlay = <TopRightButtons />;

    return (
        <AuthLayoutClient
            cardContent={cardContent}
            backgroundContent={backgroundContent}
            overlay={overlay}
        />
    );
};
```

### Get-Started Page
```tsx
import { GetStartedLayout } from "@/components/get-started/GetStartedLayout";

export default function Page() {
    return (
        <GetStartedLayout>
            <DocsZeroState user={session.user} />
        </GetStartedLayout>
    );
}
```

## Route Transition Animation

The animation automatically triggers when navigating between `/login` and `/get-started`:

1. **User logs in at `/login`** - Card is on the left
2. **User redirects to `/get-started`** - Card smoothly animates to center, background fades out
3. **Smooth 500ms transition** - Uses Tailwind's `transition-all` with `ease-in-out`

## Animation Details

**Card Animation:**
- Width: `40%` → `60%`
- Position: Left-aligned → Centered (`mx-auto`)
- Margin: Adjusts for centering

**Background Animation:**
- Opacity: `100%` → `0%`
- Width: `flex-1` → `0`
- Display: Visible → Hidden

**Timing:**
- Duration: 500ms (customizable)
- Easing: `ease-in-out`
- Delay: 50ms on route change (ensures smooth transition)

## Customization

### Change Animation Duration
```tsx
<AuthLayoutClient
    cardContent={content}
    backgroundContent={background}
    animationDuration={1000} // 1 second
/>
```

### Force Center on Any Route
```tsx
<AuthLayoutClient
    cardContent={content}
    backgroundContent={background}
    forceCenter={true} // Always centered
/>
```

### Custom Card/Background Styles
```tsx
<SplitLayout
    cardContent={content}
    backgroundContent={background}
    cardClassName="md:w-[50%]" // Custom width
    backgroundClassName="bg-gradient-to-r from-blue-500 to-purple-500"
/>
```

## File Structure

```
components/
├── layout/
│   ├── SplitLayout.tsx              # Base layout component
│   ├── AuthLayoutClient.tsx         # Route-based wrapper
│   └── SplitLayout.README.md        # This file
├── login-page/
│   └── LoginPage.tsx                # Refactored to use SplitLayout
└── get-started/
    └── GetStartedLayout.tsx         # Get-started wrapper
```

## Notes

- Both pages share the same branding/background to maintain consistency
- The animation only occurs on desktop (md breakpoint and above)
- Mobile view always shows full-width card with no background
- Uses Next.js App Router conventions with `"use client"` where needed
