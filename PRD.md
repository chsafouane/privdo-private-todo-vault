# Planning Guide

A privacy-focused todo task manager that stores all data locally with end-to-end encryption, accessible from any device. Optional E2E encrypted sync keeps devices in sync without the server ever seeing your data.

Available as a web app, PWA, macOS desktop app (Electron), Chrome/Brave extension, and iOS/Android app (Capacitor).

**Experience Qualities**: 
1. **Minimal** - Clean, distraction-free interface that gets out of your way and lets you focus on tasks
2. **Instant** - Zero-latency interactions with immediate feedback for every action you take
3. **Trustworthy** - All data encrypted on your device with AES-256. Optional sync is end-to-end encrypted — the server never sees plaintext.

**Complexity Level**: Medium Application (multi-list vault, encrypted storage, cross-device sync, multi-platform)
A task management app with a vault-based data model (multiple named lists, each containing tasks), PIN-based encryption, drag-and-drop reordering, optional E2E encrypted sync, and cross-platform deployment.

## Essential Features

**PIN-Protected Vault**
- Functionality: All data is stored in an AES-256 encrypted vault, unlocked by a numeric PIN
- Purpose: Protect task data at rest — PIN never leaves the device
- Trigger: App launch or after 5-minute inactivity auto-lock
- Progression: Open app → Enter PIN → Vault decrypted → Land on last-used list
- Success criteria: Incorrect PIN shows error; correct PIN decrypts instantly; auto-lock after 5 min of inactivity

**Multiple Task Lists**
- Functionality: Organize tasks into named lists inside the encrypted vault. Create, rename, and delete lists.
- Purpose: Separate work, personal, and other contexts without switching apps
- Trigger: Tap active list name in header → opens list selector dialog
- Progression: Tap list name → Dialog shows all lists with task counts → Create new / rename / delete / switch
- Success criteria: Switching lists is instant; last-used list is remembered; deleting a list is soft-delete (syncs correctly); at least one list must always exist

**Add New Task**
- Functionality: Create a new task with a title and optional deadline
- Purpose: Capture tasks quickly without friction
- Trigger: Click add button or press Enter in input field; on mobile, tap floating action button to reveal form
- Progression: Click input field → Type task text → Optionally set deadline → Press Enter or click add → Task appears in list → Input clears
- Success criteria: Task appears immediately in the list with correct sortOrder, input is cleared and ready for next task

**Complete/Uncomplete Task**
- Functionality: Toggle task completion status with visual feedback
- Purpose: Track progress and maintain sense of accomplishment
- Trigger: Click checkbox next to task
- Progression: Click checkbox → Checkbox animates to checked state → Task text gets strikethrough style → Moves to completed section
- Success criteria: State persists across page refreshes, visual change is immediate and satisfying

**Edit Task**
- Functionality: Modify task text and deadline inline
- Purpose: Correct mistakes or update task details without recreating
- Trigger: Click on task text
- Progression: Click task text → Text and deadline become editable → Modify → Click outside or press Enter → Task updates
- Success criteria: Changes save immediately, easy to cancel by pressing Escape

**Delete Task**
- Functionality: Remove task with undo support
- Purpose: Clean up completed or irrelevant tasks
- Trigger: Tap delete icon, or swipe left on mobile
- Progression: Swipe left or tap trash → Task soft-deleted → Undo toast for 5 seconds → Tombstone remains for sync
- Success criteria: 5-second undo window, tombstone-based soft delete for sync compatibility

**Drag & Drop Reordering**
- Functionality: Reorder active tasks by dragging via a handle
- Purpose: Let users prioritize tasks in their preferred order
- Trigger: Press and hold the drag handle (six dots icon) on a task
- Progression: Grab handle → Drag task up/down → Release → sortOrder values updated
- Success criteria: New order persists across refreshes and syncs correctly

**Search**
- Functionality: Filter tasks by text within the active list
- Purpose: Quickly find a task in a long list
- Trigger: Click magnifying glass icon in header
- Progression: Click icon → Search bar expands with animation → Type query → Tasks filter in real time → Click X or clear to dismiss
- Success criteria: Filters both active and completed sections; empty query shows all tasks

**Deadlines & Notifications**
- Functionality: Set optional due dates on tasks; overdue tasks highlighted in red
- Purpose: Time-sensitive task tracking
- Trigger: Set deadline when creating or editing a task
- Progression: Pick date/time → Deadline shown on task → Overdue tasks shown in red with bold styling → Desktop notification if supported
- Success criteria: Overdue detection is accurate; visual distinction is clear

**Persistent Encrypted Storage**
- Functionality: All data stored as an encrypted vault blob using AES-256 (PBKDF2, 600k iterations). IndexedDB on web, filesystem on Electron, localStorage on extension.
- Purpose: Data survives page refreshes and is encrypted at rest
- Trigger: Automatic on every state change
- Progression: Any modification → Vault re-encrypted → Persisted to storage
- Success criteria: Opening app and entering PIN shows all previous data; raw storage is opaque ciphertext

**End-to-End Encrypted Sync (Optional)**
- Functionality: Cross-device sync via Supabase. Two modes — passphrase (12-word BIP39, no account) or email+password. Server is zero-knowledge.
- Purpose: Keep tasks in sync across devices without sacrificing privacy
- Trigger: Click cloud icon in header → configure sync
- Progression: Choose mode → Enter credentials → Derive channel ID + sync key client-side → Pull/merge/push encrypted blobs
- Sync behavior: On app open, on task change (2s debounce), every 5 minutes, manual "Sync Now"
- Success criteria: Merge is conflict-free (LWW per field); server never sees plaintext; offline changes sync when connectivity returns

**Export / Import**
- Functionality: Export vault as PIN-encrypted JSON backup; import from file
- Purpose: Manual backup and migration between devices
- Trigger: Export/import buttons in header toolbar
- Progression: Export → Downloads encrypted `.json` file. Import → File picker → Decrypt with PIN → Merge into current list or load vault
- Success criteria: Supports both vault format and legacy single-list format on import

**Priority Levels**
- Functionality: Assign a priority level (none, low, medium, high) to any task. Displayed as a colored dot (none=hidden, low=green, medium=yellow, high=red).
- Purpose: Quickly identify the most important tasks at a glance
- Trigger: Click one of the four priority circles when creating or editing a task
- Progression: Tap priority dot → Selected dot gets a ring highlight → Task displays colored priority indicator → Scheduled tasks sort by date then priority descending
- Success criteria: Priority persists across refreshes and syncs; colored dots are visible but unobtrusive; sorting feels natural

**Recurring Tasks**
- Functionality: Set a task to recur daily, weekly, or monthly. On completion, the next occurrence is automatically created with an updated deadline.
- Purpose: Support repeating tasks (habits, reviews, recurring chores) without manual re-creation
- Trigger: Select a recurrence frequency (D/W/M) when creating or editing a task that has a deadline
- Progression: Set deadline → Recurrence picker appears → Select frequency → Complete task → Next occurrence auto-created with new deadline → Toast confirms "Next occurrence created"
- Success criteria: Recurrence picker only visible when deadline is set; overdue recurring tasks use today + interval (not missed date); completed instance has recurrence cleared; new instance inherits text, list, and priority

**Dark / Light Mode**
- Functionality: Toggle between dark and light themes
- Purpose: Comfortable viewing in any lighting condition
- Trigger: Sun/Moon icon in header
- Success criteria: Follows system preference by default; manual toggle persists

**Collapsible Completed Section**
- Functionality: Completed tasks shown in a collapsible section below active tasks
- Purpose: Keep focus on active tasks without hiding progress
- Trigger: Click section header to expand/collapse
- Progression: Toggle → Section animates open/closed → "Clear" button bulk-deletes all completed
- Success criteria: Collapse state is intuitive; bulk clear uses soft-delete with tombstones

## Edge Case Handling

- **Empty Task Submission**: Prevent creating tasks with only whitespace — trim input and ignore if empty
- **Rapid Task Creation**: Handle multiple rapid Enter presses gracefully without duplicate tasks
- **Recurring Task Overdue**: When a recurring task is completed past its deadline, the next occurrence uses today + interval (not the missed deadline + interval) to avoid cascading overdue tasks
- **Recurrence Without Deadline**: Recurrence picker is hidden when no deadline is set; clearing a deadline also clears recurrence
- **Empty State**: Show helpful empty state message when no tasks exist to guide new users
- **All Tasks Completed**: Show "All done! 🎉" celebration message
- **Very Long Task Text**: Allow long text but truncate display with ellipsis, show full text when editing
- **Single List Guard**: Cannot delete the last remaining list
- **Legacy Migration**: On first vault load, auto-migrate legacy single-list task arrays into a "My Tasks" list
- **Sync Backward Compatibility**: Sync engine detects remote format (legacy Task[] vs Vault) and wraps appropriately
- **Import Compatibility**: Import accepts both vault format and legacy single-list format
- **Offline Sync**: Changes queue locally and sync when connectivity returns; toast on online/offline transitions
- **Auto-Lock**: After 5 minutes of inactivity, encryption key is cleared and user returns to PIN screen
- **Tombstone Pruning**: Soft-deleted tasks older than 30 days are permanently removed

## Design Direction

The design should evoke feelings of calm focus, clarity, and trustworthiness. It should feel like a personal, private space - secure and uncluttered. The interface should fade into the background, letting tasks take center stage with just enough visual delight to feel pleasant without being distracting.

## Color Selection

A serene, focused palette with soft neutrals and a calming blue accent that conveys trust and security.

- **Primary Color**: Deep Ocean Blue `oklch(0.45 0.15 250)` - Represents trust, security, and calm focus for primary actions
- **Secondary Colors**: Soft Gray `oklch(0.96 0.005 250)` for backgrounds, Medium Gray `oklch(0.65 0.01 250)` for subtle elements
- **Accent Color**: Bright Teal `oklch(0.70 0.15 190)` - Energizing highlight for completed tasks and success states
- **Foreground/Background Pairings**: 
  - Background (Soft Cream `oklch(0.98 0.01 85)`): Deep Slate `oklch(0.25 0.02 250)` - Ratio 13.2:1 ✓
  - Primary (Deep Ocean Blue `oklch(0.45 0.15 250)`): White `oklch(1 0 0)` - Ratio 6.8:1 ✓
  - Accent (Bright Teal `oklch(0.70 0.15 190)`): Deep Slate `oklch(0.25 0.02 250)` - Ratio 5.2:1 ✓
  - Muted (Light Gray `oklch(0.93 0.005 250)`): Medium Slate `oklch(0.50 0.02 250)` - Ratio 5.5:1 ✓

## Font Selection

Typography should feel modern, clean, and highly legible with a touch of warmth to make the interface feel approachable rather than sterile.

- **Typographic Hierarchy**: 
  - App Title: Plus Jakarta Sans Bold / 24px / -0.02em letter spacing
  - Task Text: Plus Jakarta Sans Regular / 16px / normal letter spacing / 1.5 line height
  - Placeholder Text: Plus Jakarta Sans Regular / 16px / reduced opacity
  - Empty State: Plus Jakarta Sans Medium / 14px / 0.01em letter spacing

## Animations

Animations should provide subtle confirmation of actions and maintain spatial continuity. Use gentle spring physics for organic feel — checkboxes bounce slightly when checked, tasks fade in when created, strikethrough animates across completed tasks, delete actions slide out left, swipe-to-delete reveals red background, search bar animates expand/collapse, and drag-and-drop uses layout animations. Avoid excessive motion that delays interaction.

## Component Selection

- **Components**: 
  - Input for task entry with auto-focus and optional deadline picker
  - Button for primary add action with icon
  - Checkbox for completion toggle
  - Card or subtle container for each task item with drag handle
  - Dialog for list selector (create, rename, delete, switch lists)
  - Scroll Area for task list when content overflows
  - Badge for active task count on list name
  - Collapsible section for completed tasks with bulk clear
  - Floating Action Button (mobile) for toggling add form
  - Search bar with animated expand/collapse
  
- **Customizations**: 
  - Custom task list item combining drag handle, checkbox, editable text span, deadline display, and delete button in horizontal layout
  - Inline edit state that transforms static text and deadline into inputs seamlessly
  - Animated checkbox with custom checkmark that scales in
  - Swipe-to-delete gesture on mobile (drag="x", red trash background reveal)
  - Drag-and-drop reordering via Framer Motion Reorder for active tasks
  
- **States**: 
  - Input: Focus state with subtle blue border glow, disabled when empty
  - Checkbox: Unchecked (empty), Checked (filled with animated checkmark), Hover (scale up slightly)
  - Task Item: Default, Hover (show delete button), Editing (text becomes input), Completed (strikethrough, muted color)
  - Delete Button: Hidden by default, appears on hover, hover brightens to red
  
- **Icon Selection**: 
  - Plus (task addition)
  - Check (task completion) 
  - Trash (task deletion)
  - DotsSixVertical (drag handle for reordering)
  - MagnifyingGlass (search toggle)
  - Clock (deadline indicator)
  - Lock (encryption / PIN screen)
  - Cloud / CloudSlash (sync status)
  - ArrowsClockwise (recurring task badge)
  - CaretRight (list selector trigger)
  - Sun / Moon (theme toggle)
  - Export / UploadSimple (export/import)
  
- **Spacing**: 
  - Container padding: p-6 (24px)
  - Task item gap: gap-3 (12px)
  - Section spacing: space-y-4 (16px between sections)
  - Input padding: px-4 py-3 (16px horizontal, 12px vertical)
  
- **Mobile**: 
  - Stack everything vertically in single column
  - Increase touch targets to minimum 44px height
  - Task items expand to full width with comfortable padding
  - Delete button always visible on mobile (no hover state)
  - Fixed position for add task input at top, scrollable task list below
  - Bottom safe area padding for iOS devices
