# Fern Dashboard Test Plan

## Application Overview

The Fern Dashboard is a Next.js application that provides a comprehensive interface for managing API documentation, SDKs, incidents, and organizational settings. The application supports multiple authentication methods (Google, GitHub, Email, and CI testing credentials) and includes role-based access control with different permission levels. Key features include documentation management, visual editor, web analytics, search analytics, incident tracking, API key management, member management, and organization settings.

## Test Scenarios

### 1. Authentication

**Seed:** `dashboard/seed.spec.ts`

#### 1.1. Admin Login with CI Credentials

**File:** `dashboard/authentication/admin-login.spec.ts`

**Steps:**
  1. Navigate to http://localhost:3001/login?FERN_CI_AUTOMATED_TESTING=MTdhMTczMTE4MTA
  2. Verify the CI Automated Testing Login form is visible
  3. Enter 'ci-admin@buildwithfern.com' in the email input field [data-testid='ci-email-input']
  4. Enter the CI test password in the password input field [data-testid='ci-password-input']
  5. Click the 'Sign in with test credentials' button [data-testid='ci-submit-button']
  6. Wait for redirect to dashboard home page

**Expected Results:**
  - Login page loads successfully with CI testing form visible
  - Form accepts email and password input
  - Upon successful authentication, user is redirected to the dashboard
  - No error messages are displayed
  - Dashboard displays organization content

#### 1.2. Login Page Display and Elements

**File:** `dashboard/authentication/login-page-display.spec.ts`

**Steps:**
  1. Navigate to http://localhost:3001/login
  2. Verify 'Log in to Fern' heading is visible
  3. Verify Google login button is present
  4. Verify GitHub login button is present
  5. Verify Email login form is visible
  6. Verify 'Documentation' link in top-right corner is present
  7. Verify Terms of Service link is present
  8. Verify Privacy Policy link is present
  9. Verify theme toggle button is visible (desktop only)

**Expected Results:**
  - Login page loads without errors
  - All authentication options are visible and accessible
  - Legal links are present and functional
  - Page displays correctly in both light and dark themes

#### 1.3. Login with Invalid Credentials

**File:** `dashboard/authentication/invalid-login.spec.ts`

**Steps:**
  1. Navigate to http://localhost:3001/login?FERN_CI_AUTOMATED_TESTING=MTdhMTczMTE4MTA
  2. Enter 'invalid@example.com' in the email input field
  3. Enter 'wrongpassword' in the password input field
  4. Click the 'Sign in with test credentials' button
  5. Wait for error message to appear

**Expected Results:**
  - Error message is displayed indicating login failure
  - User remains on the login page
  - Form inputs remain accessible for retry
  - Error message is clear and user-friendly

#### 1.4. Logout Flow

**File:** `dashboard/authentication/logout.spec.ts`

**Steps:**
  1. Login as admin user using CI credentials
  2. Verify successful login and dashboard display
  3. Locate and click user profile or settings menu
  4. Click logout or sign out option
  5. Wait for redirect to login page

**Expected Results:**
  - User session is terminated
  - User is redirected to login page
  - Attempting to access protected pages redirects back to login
  - No user data is accessible after logout

#### 1.5. Redirect to Dashboard When Already Authenticated

**File:** `dashboard/authentication/already-authenticated-redirect.spec.ts`

**Steps:**
  1. Login as admin user using CI credentials
  2. Verify dashboard is displayed
  3. Navigate directly to http://localhost:3001/login
  4. Observe redirect behavior

**Expected Results:**
  - User is automatically redirected away from login page
  - User lands on the dashboard or home page
  - No login form is shown to authenticated users

### 2. Documentation Management

**Seed:** `dashboard/seed.spec.ts`

#### 2.1. View Documentation Sites List

**File:** `dashboard/documentation/docs-sites-list.spec.ts`

**Steps:**
  1. Login as admin user
  2. Navigate to the docs section from the main navigation
  3. Verify the docs list page loads
  4. Check for presence of documentation sites or zero state

**Expected Results:**
  - Docs page loads successfully
  - If docs exist, they are displayed in a list or grid
  - If no docs exist, a zero state with helpful message is shown
  - Navigation to docs section is smooth and responsive

#### 2.2. Create New Documentation Site

**File:** `dashboard/documentation/create-docs-site.spec.ts`

**Steps:**
  1. Login as admin user
  2. Navigate to docs section
  3. Click 'Create New' or similar button for creating documentation
  4. Fill in required fields for documentation site (name, URL, etc.)
  5. Submit the form
  6. Wait for confirmation of creation

**Expected Results:**
  - Creation form is accessible and displays all required fields
  - Form validation works correctly for required fields
  - Successful creation shows confirmation message
  - New documentation site appears in the list
  - User is redirected to the new documentation site details or settings

#### 2.3. View Documentation Site Details

**File:** `dashboard/documentation/docs-site-details.spec.ts`

**Steps:**
  1. Login as admin user
  2. Navigate to docs section
  3. Click on an existing documentation site
  4. Verify the documentation details page loads
  5. Check for presence of settings, analytics, and other tabs

**Expected Results:**
  - Documentation site details page loads successfully
  - Site information is displayed correctly
  - Navigation tabs for settings, analytics, etc. are visible
  - Page layout is clean and organized

#### 2.4. Access Documentation Settings

**File:** `dashboard/documentation/docs-settings.spec.ts`

**Steps:**
  1. Login as admin user
  2. Navigate to a documentation site
  3. Click on 'Settings' tab
  4. Verify settings page displays configuration options

**Expected Results:**
  - Settings page loads successfully
  - Configuration options are visible and editable
  - Settings are organized into logical sections
  - Save/Update buttons are present

#### 2.5. View Documentation Web Analytics

**File:** `dashboard/documentation/docs-web-analytics.spec.ts`

**Steps:**
  1. Login as admin user
  2. Navigate to a documentation site
  3. Click on 'Web Analytics' or 'Analytics' tab
  4. Verify analytics dashboard loads
  5. Check for presence of metrics, charts, or graphs

**Expected Results:**
  - Analytics page loads successfully
  - Metrics and data visualizations are displayed
  - Page views, user interactions, or similar metrics are shown
  - Data is presented in a clear, understandable format

#### 2.6. View Documentation Search Analytics

**File:** `dashboard/documentation/docs-search-analytics.spec.ts`

**Steps:**
  1. Login as admin user
  2. Navigate to a documentation site
  3. Click on 'Search' or 'Search Analytics' tab
  4. Verify search analytics page loads
  5. Check for search query data, trends, or metrics

**Expected Results:**
  - Search analytics page loads successfully
  - Search query data is displayed
  - Metrics show search usage patterns
  - Information is actionable for improving documentation

#### 2.7. Access Ask Fern (AI Features)

**File:** `dashboard/documentation/ask-fern.spec.ts`

**Steps:**
  1. Login as admin user
  2. Navigate to a documentation site
  3. Click on 'Ask Fern' tab
  4. Verify Ask Fern page loads
  5. Check for AI-related settings or configurations

**Expected Results:**
  - Ask Fern page loads successfully
  - AI features are accessible
  - Configuration options for AI are visible
  - Page provides information about AI capabilities

#### 2.8. View Documentation Feedback

**File:** `dashboard/documentation/docs-feedback.spec.ts`

**Steps:**
  1. Login as admin user
  2. Navigate to a documentation site
  3. Click on 'Feedback' tab
  4. Verify feedback page loads
  5. Check for user feedback submissions or feedback management tools

**Expected Results:**
  - Feedback page loads successfully
  - User feedback is displayed if available
  - Feedback is organized and easy to review
  - Tools for managing feedback are accessible

#### 2.9. Access Link Checker

**File:** `dashboard/documentation/link-checker.spec.ts`

**Steps:**
  1. Login as admin user
  2. Navigate to a documentation site
  3. Click on 'Link Checker' tab or similar option
  4. Verify link checker page loads
  5. Check for broken link reports or link validation results

**Expected Results:**
  - Link checker page loads successfully
  - Link validation results are displayed
  - Broken or invalid links are clearly identified
  - Page provides actionable information for fixing links

#### 2.10. Manage Documentation Members

**File:** `dashboard/documentation/docs-members.spec.ts`

**Steps:**
  1. Login as admin user
  2. Navigate to a documentation site
  3. Click on 'Members' tab
  4. Verify members management page loads
  5. Check for list of current members with their roles

**Expected Results:**
  - Members page loads successfully
  - Current members are listed with their roles and permissions
  - Options to add, remove, or modify member access are visible
  - Role-based access control is clearly indicated

### 3. Visual Editor

**Seed:** `dashboard/seed.spec.ts`

#### 3.1. Access Visual Editor

**File:** `dashboard/visual-editor/access-editor.spec.ts`

**Steps:**
  1. Login as admin user
  2. Navigate to a documentation site
  3. Click 'Edit' or 'Visual Editor' button
  4. Verify editor interface loads
  5. Check for editor panels, toolbar, and content area

**Expected Results:**
  - Visual editor loads successfully
  - Editor interface is responsive and functional
  - All editor components (sidebar, main editor, preview) are visible
  - Editor is ready for content manipulation

#### 3.2. Navigate Between Documentation Pages in Editor

**File:** `dashboard/visual-editor/editor-navigation.spec.ts`

**Steps:**
  1. Login as admin user
  2. Open visual editor for a documentation site
  3. Use sidebar navigation to switch between pages
  4. Verify content updates in the editor

**Expected Results:**
  - Sidebar navigation is functional
  - Clicking different pages loads their content in the editor
  - Content switching is smooth without errors
  - Current page is highlighted in navigation

#### 3.3. Edit Documentation Content

**File:** `dashboard/visual-editor/edit-content.spec.ts`

**Steps:**
  1. Login as admin user
  2. Open visual editor for a documentation site
  3. Select a page to edit
  4. Modify text content in the editor
  5. Save changes
  6. Verify save confirmation

**Expected Results:**
  - Content is editable in the visual editor
  - Changes are reflected in real-time or after save
  - Save operation completes successfully
  - Confirmation message is displayed
  - Modified content persists after save

#### 3.4. Switch Branches in Visual Editor

**File:** `dashboard/visual-editor/branch-switching.spec.ts`

**Steps:**
  1. Login as admin user
  2. Open visual editor for a documentation site
  3. Locate branch selector
  4. Switch to a different branch
  5. Verify content updates for the selected branch

**Expected Results:**
  - Branch selector is accessible
  - Available branches are listed
  - Switching branches loads the correct content
  - Current branch is clearly indicated
  - Branch switching is smooth and responsive

#### 3.5. Preview Documentation Changes

**File:** `dashboard/visual-editor/preview-changes.spec.ts`

**Steps:**
  1. Login as admin user
  2. Open visual editor for a documentation site
  3. Make changes to documentation content
  4. Click 'Preview' or similar option
  5. Verify preview displays changes

**Expected Results:**
  - Preview functionality is accessible
  - Preview accurately reflects made changes
  - Preview renders documentation as it will appear to users
  - Preview can be exited to return to editing

### 4. Incidents Management

**Seed:** `dashboard/seed.spec.ts`

#### 4.1. Access Incidents Page

**File:** `dashboard/incidents/access-incidents.spec.ts`

**Steps:**
  1. Login as admin user
  2. Navigate to 'Incidents' section from main navigation
  3. Verify incidents page loads
  4. Check for incidents list or creation form

**Expected Results:**
  - Incidents page loads successfully (if feature flag is enabled)
  - If feature is disabled, user is redirected appropriately
  - Page displays existing incidents or empty state
  - Create incident option is visible

#### 4.2. Create New Incident

**File:** `dashboard/incidents/create-incident.spec.ts`

**Steps:**
  1. Login as admin user
  2. Navigate to Incidents page
  3. Click 'Create Incident' or similar button
  4. Fill in incident details (title, description, severity, etc.)
  5. Submit the form
  6. Wait for confirmation

**Expected Results:**
  - Incident creation form is accessible
  - All required fields are present and labeled
  - Form validation works correctly
  - Successful creation shows confirmation message
  - New incident appears in incidents list

#### 4.3. View Incident Details

**File:** `dashboard/incidents/view-incident.spec.ts`

**Steps:**
  1. Login as admin user
  2. Navigate to Incidents page
  3. Click on an existing incident
  4. Verify incident details page loads
  5. Check for incident information, status, and timeline

**Expected Results:**
  - Incident details page loads successfully
  - All incident information is displayed correctly
  - Status and severity are clearly shown
  - Timeline or history of incident is visible

#### 4.4. Update Incident Status

**File:** `dashboard/incidents/update-incident-status.spec.ts`

**Steps:**
  1. Login as admin user
  2. Navigate to an existing incident
  3. Locate status change option
  4. Change incident status (e.g., from 'Open' to 'Resolved')
  5. Save changes
  6. Verify status update confirmation

**Expected Results:**
  - Status change option is accessible
  - Available status options are listed
  - Status change is saved successfully
  - Confirmation message is displayed
  - Updated status is reflected in incident details

#### 4.5. Initialize Incident Severities

**File:** `dashboard/incidents/initialize-severities.spec.ts`

**Steps:**
  1. Login as admin user
  2. Navigate to Incidents page for the first time
  3. Verify automatic initialization of severity levels
  4. Check that severity options are available for incident creation

**Expected Results:**
  - Severity levels are initialized automatically if not present
  - Default severities are available for selection
  - Initialization happens seamlessly without user intervention
  - No errors occur during initialization

### 5. Organization Management

**Seed:** `dashboard/seed.spec.ts`

#### 5.1. View Organization Settings

**File:** `dashboard/organization/view-settings.spec.ts`

**Steps:**
  1. Login as admin user
  2. Navigate to 'Settings' from main navigation
  3. Verify organization settings page loads
  4. Check for configuration options

**Expected Results:**
  - Settings page loads successfully
  - Organization information is displayed
  - Configuration options are accessible
  - Page is organized into clear sections

#### 5.2. Update Organization Settings

**File:** `dashboard/organization/update-settings.spec.ts`

**Steps:**
  1. Login as admin user
  2. Navigate to Settings page
  3. Modify a setting (e.g., organization name)
  4. Click 'Save' or 'Update' button
  5. Wait for confirmation

**Expected Results:**
  - Settings can be modified
  - Form validation works correctly
  - Changes are saved successfully
  - Confirmation message is displayed
  - Updated settings are reflected immediately

#### 5.3. View Organization Members

**File:** `dashboard/organization/view-members.spec.ts`

**Steps:**
  1. Login as admin user
  2. Navigate to 'Members' section
  3. Verify members list page loads
  4. Check for list of organization members with their roles

**Expected Results:**
  - Members page loads successfully
  - All organization members are listed
  - Member roles and permissions are visible
  - Page provides options for member management

#### 5.4. Invite New Member

**File:** `dashboard/organization/invite-member.spec.ts`

**Steps:**
  1. Login as admin user
  2. Navigate to Members page
  3. Click 'Invite Member' or similar button
  4. Enter new member's email address
  5. Select role for the new member
  6. Submit invitation
  7. Wait for confirmation

**Expected Results:**
  - Invitation form is accessible
  - Email and role fields are present
  - Form validation ensures valid email format
  - Invitation is sent successfully
  - Confirmation message is displayed
  - Pending invitation appears in members list

#### 5.5. Change Member Role

**File:** `dashboard/organization/change-member-role.spec.ts`

**Steps:**
  1. Login as admin user
  2. Navigate to Members page
  3. Locate an existing member
  4. Click 'Change Role' or similar option
  5. Select a different role
  6. Confirm the change
  7. Verify role update

**Expected Results:**
  - Role change option is accessible
  - Available roles are listed
  - Role change is saved successfully
  - Confirmation message is displayed
  - Updated role is reflected in members list

#### 5.6. Remove Member from Organization

**File:** `dashboard/organization/remove-member.spec.ts`

**Steps:**
  1. Login as admin user
  2. Navigate to Members page
  3. Locate a member to remove
  4. Click 'Remove' or similar option
  5. Confirm removal in confirmation dialog
  6. Verify member is removed from list

**Expected Results:**
  - Remove option is accessible
  - Confirmation dialog appears before removal
  - Member is removed successfully after confirmation
  - Removed member no longer appears in members list
  - Confirmation message is displayed

#### 5.7. Accept Organization Invite

**File:** `dashboard/organization/accept-invite.spec.ts`

**Steps:**
  1. Have an admin send an invitation to a new email
  2. Open the invitation link (e.g., /accept-invite/[token])
  3. Verify invitation acceptance page loads
  4. Complete any required steps to accept
  5. Verify user is added to organization

**Expected Results:**
  - Invitation page loads with valid token
  - User can see invitation details
  - Acceptance process completes successfully
  - User gains access to the organization
  - User is redirected to organization dashboard

### 6. API Keys Management

**Seed:** `dashboard/seed.spec.ts`

#### 6.1. View API Keys

**File:** `dashboard/api-keys/view-api-keys.spec.ts`

**Steps:**
  1. Login as admin user
  2. Navigate to 'API Keys' section
  3. Verify API keys page loads
  4. Check for list of existing API keys or empty state

**Expected Results:**
  - API keys page loads successfully
  - Existing API keys are displayed if available
  - Empty state is shown if no keys exist
  - Create new key option is visible

#### 6.2. Create New API Key

**File:** `dashboard/api-keys/create-api-key.spec.ts`

**Steps:**
  1. Login as admin user
  2. Navigate to API Keys page
  3. Click 'Create API Key' or similar button
  4. Provide a name or description for the key
  5. Submit the form
  6. Verify key creation and display of new key

**Expected Results:**
  - API key creation form is accessible
  - Required fields are present
  - New API key is generated successfully
  - Generated key is displayed (one-time view)
  - Confirmation message is shown
  - New key appears in API keys list

#### 6.3. Copy API Key

**File:** `dashboard/api-keys/copy-api-key.spec.ts`

**Steps:**
  1. Login as admin user
  2. Create a new API key
  3. Verify copy button or icon is present
  4. Click the copy button
  5. Verify copy confirmation (tooltip or message)

**Expected Results:**
  - Copy functionality is available
  - Clicking copy button copies key to clipboard
  - Confirmation of copy action is displayed
  - Copied key can be pasted elsewhere

#### 6.4. Revoke API Key

**File:** `dashboard/api-keys/revoke-api-key.spec.ts`

**Steps:**
  1. Login as admin user
  2. Navigate to API Keys page
  3. Locate an existing API key
  4. Click 'Revoke' or 'Delete' option
  5. Confirm revocation in confirmation dialog
  6. Verify key is revoked

**Expected Results:**
  - Revoke option is accessible
  - Confirmation dialog appears before revocation
  - API key is revoked successfully
  - Revoked key is removed from list or marked as revoked
  - Confirmation message is displayed

### 7. SDKs Management

**Seed:** `dashboard/seed.spec.ts`

#### 7.1. View SDKs Page

**File:** `dashboard/sdks/view-sdks.spec.ts`

**Steps:**
  1. Login as admin user
  2. Navigate to 'SDKs' section from main navigation
  3. Verify SDKs page loads
  4. Check for list of SDKs or SDK-related information

**Expected Results:**
  - SDKs page loads successfully
  - SDK information is displayed
  - Page provides access to SDK configuration or generation
  - Navigation is clear and intuitive

#### 7.2. Access SDK Configuration

**File:** `dashboard/sdks/sdk-configuration.spec.ts`

**Steps:**
  1. Login as admin user
  2. Navigate to SDKs page
  3. Click on an SDK or 'Configure' option
  4. Verify configuration page or modal loads
  5. Check for SDK settings and options

**Expected Results:**
  - SDK configuration is accessible
  - Configuration options are displayed
  - Settings can be modified
  - Save functionality is available

### 8. Billing

**Seed:** `dashboard/seed.spec.ts`

#### 8.1. View Billing Page

**File:** `dashboard/billing/view-billing.spec.ts`

**Steps:**
  1. Login as admin user
  2. Navigate to 'Billing' section
  3. Verify billing page loads
  4. Check for billing information, invoices, or payment methods

**Expected Results:**
  - Billing page loads successfully
  - Current billing plan or subscription is displayed
  - Invoice history is accessible
  - Payment methods are listed if applicable

#### 8.2. Update Payment Method

**File:** `dashboard/billing/update-payment-method.spec.ts`

**Steps:**
  1. Login as admin user
  2. Navigate to Billing page
  3. Click 'Update Payment Method' or similar option
  4. Enter new payment details
  5. Submit the form
  6. Verify payment method update confirmation

**Expected Results:**
  - Payment method form is accessible
  - Form accepts valid payment information
  - Payment method is updated successfully
  - Confirmation message is displayed
  - Updated payment method is reflected in billing settings

#### 8.3. View Invoices

**File:** `dashboard/billing/view-invoices.spec.ts`

**Steps:**
  1. Login as admin user
  2. Navigate to Billing page
  3. Locate 'Invoices' or 'Billing History' section
  4. Verify list of invoices is displayed
  5. Click on an invoice to view details or download

**Expected Results:**
  - Invoice list is displayed
  - Invoices show date, amount, and status
  - Individual invoices can be viewed or downloaded
  - Invoice details are accurate and complete

### 9. Token Management

**Seed:** `dashboard/seed.spec.ts`

#### 9.1. View Token Page

**File:** `dashboard/token/view-token.spec.ts`

**Steps:**
  1. Login as admin user
  2. Navigate to 'Token' section
  3. Verify token page loads
  4. Check for token information or management options

**Expected Results:**
  - Token page loads successfully
  - Token-related information is displayed
  - Management options for tokens are accessible
  - Page is clear and user-friendly

### 10. Navigation and Layout

**Seed:** `dashboard/seed.spec.ts`

#### 10.1. Main Navigation Accessibility

**File:** `dashboard/navigation/main-navigation.spec.ts`

**Steps:**
  1. Login as admin user
  2. Verify main navigation is visible
  3. Check for all expected navigation items (Docs, SDKs, Members, Settings, etc.)
  4. Click each navigation item
  5. Verify each page loads correctly

**Expected Results:**
  - Navigation bar is visible and accessible
  - All main sections are represented in navigation
  - Clicking navigation items loads corresponding pages
  - Current page is highlighted in navigation
  - Navigation is responsive on different screen sizes

#### 10.2. Mobile Navigation

**File:** `dashboard/navigation/mobile-navigation.spec.ts`

**Steps:**
  1. Login as admin user on mobile viewport
  2. Verify mobile navigation menu is present
  3. Open mobile menu (hamburger icon or similar)
  4. Check for all navigation items
  5. Close mobile menu

**Expected Results:**
  - Mobile navigation is accessible
  - Menu toggle works correctly
  - All navigation items are available in mobile view
  - Menu can be opened and closed smoothly
  - Navigation is usable on small screens

#### 10.3. Theme Toggle Functionality

**File:** `dashboard/navigation/theme-toggle.spec.ts`

**Steps:**
  1. Login as admin user
  2. Locate theme toggle button
  3. Verify current theme (light or dark)
  4. Click theme toggle
  5. Verify theme changes
  6. Toggle back to original theme

**Expected Results:**
  - Theme toggle button is accessible
  - Clicking toggle switches between light and dark themes
  - Theme change is applied immediately
  - All page elements adapt to theme change
  - Theme preference is persistent across page reloads

#### 10.4. Breadcrumb Navigation

**File:** `dashboard/navigation/breadcrumbs.spec.ts`

**Steps:**
  1. Login as admin user
  2. Navigate to a nested page (e.g., specific documentation site settings)
  3. Verify breadcrumb navigation is visible
  4. Click on breadcrumb items to navigate back
  5. Verify navigation works correctly

**Expected Results:**
  - Breadcrumbs are displayed on nested pages
  - Breadcrumb trail accurately reflects page hierarchy
  - Clicking breadcrumb items navigates to parent pages
  - Current page is highlighted in breadcrumbs

#### 10.5. Footer Links and Information

**File:** `dashboard/navigation/footer.spec.ts`

**Steps:**
  1. Login as admin user
  2. Scroll to bottom of any page
  3. Verify footer is visible
  4. Check for footer links (Terms, Privacy, Support, etc.)
  5. Verify footer information is accurate

**Expected Results:**
  - Footer is present on all pages
  - Footer contains relevant links and information
  - Links are functional and lead to correct destinations
  - Footer is styled appropriately

### 11. Error Handling and Edge Cases

**Seed:** `dashboard/seed.spec.ts`

#### 11.1. 404 Page Not Found

**File:** `dashboard/errors/404-not-found.spec.ts`

**Steps:**
  1. Login as admin user
  2. Navigate to a non-existent URL (e.g., /random-nonexistent-page)
  3. Verify 404 error page is displayed
  4. Check for helpful message and navigation options

**Expected Results:**
  - 404 error page loads
  - Error message is clear and user-friendly
  - Navigation options to return to valid pages are provided
  - Page styling is consistent with rest of application

#### 11.2. Error Page Display

**File:** `dashboard/errors/error-page.spec.ts`

**Steps:**
  1. Navigate to /error page
  2. Verify error page loads
  3. Check for error information and recovery options

**Expected Results:**
  - Error page displays appropriate message
  - User can navigate back to safety
  - Error doesn't crash the application

#### 11.3. Empty States Display

**File:** `dashboard/errors/empty-states.spec.ts`

**Steps:**
  1. Login as admin user with no existing resources
  2. Navigate to Docs section (expect zero state)
  3. Verify empty state message is displayed
  4. Check for call-to-action to create first resource
  5. Repeat for other sections (SDKs, Incidents, etc.)

**Expected Results:**
  - Empty states are displayed when no resources exist
  - Messages are helpful and guide user to next action
  - Call-to-action buttons are prominent
  - Empty states are visually appealing

#### 11.4. Form Validation Errors

**File:** `dashboard/errors/form-validation.spec.ts`

**Steps:**
  1. Login as admin user
  2. Navigate to any form (e.g., create documentation, invite member)
  3. Submit form with invalid data (empty required fields, invalid format, etc.)
  4. Verify validation errors are displayed
  5. Correct errors and resubmit

**Expected Results:**
  - Validation errors are shown for invalid inputs
  - Error messages are clear and specific
  - Form highlights fields with errors
  - Form can be corrected and successfully submitted
  - Validation happens on client-side before submission

#### 11.5. Network Error Handling

**File:** `dashboard/errors/network-errors.spec.ts`

**Steps:**
  1. Login as admin user
  2. Simulate network failure (if possible with testing tools)
  3. Attempt to perform an action requiring server communication
  4. Verify error message is displayed
  5. Restore network and retry action

**Expected Results:**
  - Network errors are caught gracefully
  - User-friendly error message is displayed
  - Application doesn't crash or become unusable
  - User can retry action after network restoration

#### 11.6. Session Expiration Handling

**File:** `dashboard/errors/session-expiration.spec.ts`

**Steps:**
  1. Login as admin user
  2. Wait for session to expire (or simulate expiration)
  3. Attempt to perform an action
  4. Verify user is redirected to login page
  5. Login again and verify previous action can be completed

**Expected Results:**
  - Expired session is detected
  - User is redirected to login page
  - Session expiration message is displayed
  - After re-login, user can continue their work
  - No data loss occurs due to session expiration

### 12. Role-Based Access Control

**Seed:** `dashboard/seed.spec.ts`

#### 12.1. Admin Access to All Features

**File:** `dashboard/rbac/admin-access.spec.ts`

**Steps:**
  1. Login as admin user
  2. Navigate to all main sections (Docs, Members, Settings, Billing, etc.)
  3. Verify admin has access to all features
  4. Check for edit and delete permissions on resources

**Expected Results:**
  - Admin can access all pages and features
  - Admin has full CRUD permissions on all resources
  - No features are restricted for admin role
  - Admin-specific options are visible

#### 12.2. Member Access Restrictions

**File:** `dashboard/rbac/member-access.spec.ts`

**Steps:**
  1. Login as member user (if test credentials exist)
  2. Attempt to access admin-only features
  3. Verify appropriate restrictions are in place
  4. Check that member can access allowed features

**Expected Results:**
  - Member cannot access admin-only features
  - Restricted pages redirect or show access denied message
  - Member can access features appropriate to their role
  - UI doesn't show options unavailable to members

#### 12.3. Viewer Read-Only Access

**File:** `dashboard/rbac/viewer-access.spec.ts`

**Steps:**
  1. Login as viewer user (if test credentials exist)
  2. Navigate to various sections
  3. Verify viewer has read-only access
  4. Attempt to perform edit or delete actions
  5. Verify actions are prevented

**Expected Results:**
  - Viewer can view resources but cannot modify them
  - Edit and delete buttons are hidden or disabled
  - Attempting restricted actions shows appropriate message
  - Viewer role limitations are clear in the UI

#### 12.4. Fine-Grained Permissions Enforcement

**File:** `dashboard/rbac/fine-grained-permissions.spec.ts`

**Steps:**
  1. Login as user with fine-grained permissions enabled
  2. Navigate to features with specific permissions
  3. Verify access is granted or denied based on permissions
  4. Check for permission-specific UI elements

**Expected Results:**
  - Fine-grained permissions are enforced correctly
  - Users only see and access features they have permissions for
  - Permission checks happen on both client and server side
  - Permission denied messages are clear

### 13. Search Functionality

**Seed:** `dashboard/seed.spec.ts`

#### 13.1. Global Search

**File:** `dashboard/search/global-search.spec.ts`

**Steps:**
  1. Login as admin user
  2. Locate global search input (if exists)
  3. Enter a search query
  4. Verify search results are displayed
  5. Click on a result to navigate

**Expected Results:**
  - Global search is accessible from any page
  - Search returns relevant results
  - Results are displayed quickly
  - Clicking results navigates to correct pages
  - Search handles no results gracefully

### 14. Onboarding and Getting Started

**Seed:** `dashboard/seed.spec.ts`

#### 14.1. Access Getting Started Page

**File:** `dashboard/onboarding/getting-started.spec.ts`

**Steps:**
  1. Login as new admin user (or navigate to /get-started)
  2. Verify getting started page loads
  3. Check for onboarding steps or guidance
  4. Follow any provided instructions

**Expected Results:**
  - Getting started page loads successfully
  - Onboarding information is clear and helpful
  - Steps guide user through initial setup
  - Page is visually appealing and engaging
