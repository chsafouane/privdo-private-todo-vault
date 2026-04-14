# Planning Guide

A simple, privacy-focused todo task manager that stores all data locally with end-to-end encryption, accessible from any device via web browser.

**Experience Qualities**: 
1. **Minimal** - Clean, distraction-free interface that gets out of your way and lets you focus on tasks
2. **Instant** - Zero-latency interactions with immediate feedback for every action you take
3. **Trustworthy** - All data stays on your device with encryption, no cloud sync, complete privacy

**Complexity Level**: Light Application (multiple features with basic state)
This is a straightforward task management app with core CRUD operations, task completion states, and local persistence. It doesn't require complex views or integrations.

## Essential Features

**Add New Task**
- Functionality: Create a new task with a title
- Purpose: Capture tasks quickly without friction
- Trigger: Click add button or press Enter in input field
- Progression: Click input field → Type task text → Press Enter or click add → Task appears in list → Input clears
- Success criteria: Task appears immediately in the list, input is cleared and ready for next task

**Complete/Uncomplete Task**
- Functionality: Toggle task completion status with visual feedback
- Purpose: Track progress and maintain sense of accomplishment
- Trigger: Click checkbox next to task
- Progression: Click checkbox → Checkbox animates to checked state → Task text gets strikethrough style → Moves to completed section
- Success criteria: State persists across page refreshes, visual change is immediate and satisfying

**Edit Task**
- Functionality: Modify task text inline
- Purpose: Correct mistakes or update task details without recreating
- Trigger: Click on task text
- Progression: Click task text → Text becomes editable input → Modify text → Click outside or press Enter → Task updates
- Success criteria: Changes save immediately, easy to cancel by pressing Escape

**Delete Task**
- Functionality: Remove task from list permanently
- Purpose: Clean up completed or irrelevant tasks
- Trigger: Click delete icon on task hover
- Progression: Hover over task → Delete icon appears → Click delete → Confirmation toast appears → Task fades out and removes
- Success criteria: Deletion is permanent, cannot be undone, provides brief feedback

**Persistent Storage**
- Functionality: All tasks stored locally using Spark's encrypted KV store
- Purpose: Data survives page refreshes and is encrypted at rest
- Trigger: Automatic on every state change
- Progression: Any task modification → Automatic save to KV store → Data encrypted → Persists across sessions
- Success criteria: Opening app shows all previous tasks, data is encrypted in storage

## Edge Case Handling

- **Empty Task Submission**: Prevent creating tasks with only whitespace - trim input and ignore if empty
- **Rapid Task Creation**: Debounce or handle multiple rapid Enter presses gracefully without duplicate tasks
- **Empty State**: Show helpful empty state message when no tasks exist to guide new users
- **Very Long Task Text**: Allow long text but truncate display with ellipsis, show full text on hover or when editing
- **All Tasks Completed**: Celebrate with encouraging message when all tasks are done

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

Animations should provide subtle confirmation of actions and maintain spatial continuity. Use gentle spring physics for organic feel - checkboxes bounce slightly when checked, tasks fade in when created, strikethrough animates across completed tasks, and delete actions fade out smoothly. Avoid excessive motion that delays interaction.

## Component Selection

- **Components**: 
  - Input for task entry with auto-focus
  - Button for primary add action with icon
  - Checkbox for completion toggle
  - Card or subtle container for each task item
  - Scroll Area for task list when content overflows
  - Badge for task count indicator
  - Separator between active and completed sections
  
- **Customizations**: 
  - Custom task list item combining checkbox, editable text span, and delete button in horizontal layout
  - Inline edit state that transforms static text into input seamlessly
  - Animated checkbox with custom checkmark that scales in
  
- **States**: 
  - Input: Focus state with subtle blue border glow, disabled when empty
  - Checkbox: Unchecked (empty), Checked (filled with animated checkmark), Hover (scale up slightly)
  - Task Item: Default, Hover (show delete button), Editing (text becomes input), Completed (strikethrough, muted color)
  - Delete Button: Hidden by default, appears on hover, hover brightens to red
  
- **Icon Selection**: 
  - Plus (task addition)
  - Check (task completion) 
  - X or Trash (task deletion)
  - Lock or Shield (encryption indicator in footer)
  
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
