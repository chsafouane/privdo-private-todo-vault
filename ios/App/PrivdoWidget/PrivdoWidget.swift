import WidgetKit
import SwiftUI

// MARK: – Data Model

struct WidgetTask: Codable {
    let text: String
    let completed: Bool
    let deadline: String?
}

// MARK: – Timeline Entry

struct PrivdoEntry: TimelineEntry {
    let date: Date
    let task: WidgetTask?
}

// MARK: – Timeline Provider

struct PrivdoTimelineProvider: TimelineProvider {
    private let suiteName = "group.com.privdo.app"
    private let key = "widgetTask"

    func placeholder(in context: Context) -> PrivdoEntry {
        PrivdoEntry(date: Date(), task: WidgetTask(text: "Buy groceries", completed: false, deadline: nil))
    }

    func getSnapshot(in context: Context, completion: @escaping (PrivdoEntry) -> Void) {
        completion(loadEntry())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<PrivdoEntry>) -> Void) {
        let entry = loadEntry()
        // Refresh every 15 minutes (WidgetKit minimum)
        let nextUpdate = Calendar.current.date(byAdding: .minute, value: 15, to: Date())!
        let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
        completion(timeline)
    }

    private func loadEntry() -> PrivdoEntry {
        guard let defaults = UserDefaults(suiteName: suiteName),
              let jsonString = defaults.string(forKey: key),
              let data = jsonString.data(using: .utf8) else {
            return PrivdoEntry(date: Date(), task: nil)
        }

        let task = try? JSONDecoder().decode(WidgetTask.self, from: data)
        return PrivdoEntry(date: Date(), task: task)
    }
}

// MARK: – Widget Views

struct PrivdoWidgetEntryView: View {
    var entry: PrivdoEntry
    @Environment(\.widgetFamily) var family
    @Environment(\.colorScheme) var colorScheme

    var body: some View {
        Group {
            if let task = entry.task {
                taskView(task)
            } else {
                emptyView
            }
        }
        .containerBackground(for: .widget) {
            backgroundColor
        }
    }

    private var backgroundColor: Color {
        colorScheme == .dark ? Color(red: 0.06, green: 0.06, blue: 0.06) : Color.white
    }

    private var accentColor: Color {
        Color(red: 0.38, green: 0.51, blue: 1.0)
    }

    @ViewBuilder
    private func taskView(_ task: WidgetTask) -> some View {
        switch family {
        case .systemSmall:
            smallView(task)
        case .systemMedium:
            mediumView(task)
        case .systemLarge, .systemExtraLarge:
            largeView(task)
        default:
            smallView(task)
        }
    }

    // MARK: Small (2×2)

    private func smallView(_ task: WidgetTask) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 6) {
                Image(systemName: task.completed ? "checkmark.circle.fill" : "circle")
                    .foregroundColor(task.completed ? .green : accentColor)
                    .font(.system(size: 18))
                Text("Privdo")
                    .font(.caption2)
                    .fontWeight(.semibold)
                    .foregroundColor(.secondary)
            }
            Spacer()
            Text(task.text)
                .font(.subheadline)
                .fontWeight(.medium)
                .lineLimit(3)
                .foregroundColor(.primary)
            if let dl = formattedDeadline(task.deadline) {
                Text(dl)
                    .font(.caption2)
                    .foregroundColor(isOverdue(task.deadline) ? .red : .secondary)
            }
        }
        .padding(2)
    }

    // MARK: Medium (4×2)

    private func mediumView(_ task: WidgetTask) -> some View {
        HStack(spacing: 12) {
            Image(systemName: task.completed ? "checkmark.circle.fill" : "circle")
                .foregroundColor(task.completed ? .green : accentColor)
                .font(.system(size: 28))
            VStack(alignment: .leading, spacing: 4) {
                Text(task.text)
                    .font(.body)
                    .fontWeight(.medium)
                    .lineLimit(2)
                    .foregroundColor(.primary)
                if let dl = formattedDeadline(task.deadline) {
                    HStack(spacing: 4) {
                        Image(systemName: "clock")
                            .font(.caption2)
                        Text(dl)
                            .font(.caption)
                    }
                    .foregroundColor(isOverdue(task.deadline) ? .red : .secondary)
                }
            }
            Spacer()
            Text("Privdo")
                .font(.caption2)
                .foregroundColor(.secondary)
                .rotationEffect(.degrees(-90))
        }
        .padding(4)
    }

    // MARK: Large / ExtraLarge

    private func largeView(_ task: WidgetTask) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Image(systemName: "lock.shield.fill")
                    .foregroundColor(accentColor)
                    .font(.title3)
                Text("Privdo")
                    .font(.headline)
                    .fontWeight(.bold)
                    .foregroundColor(.primary)
                Spacer()
            }

            Divider()

            HStack(alignment: .top, spacing: 14) {
                Image(systemName: task.completed ? "checkmark.circle.fill" : "circle")
                    .foregroundColor(task.completed ? .green : accentColor)
                    .font(.system(size: 32))

                VStack(alignment: .leading, spacing: 6) {
                    Text(task.text)
                        .font(.title3)
                        .fontWeight(.medium)
                        .lineLimit(family == .systemExtraLarge ? 8 : 5)
                        .foregroundColor(.primary)

                    if let dl = formattedDeadline(task.deadline) {
                        HStack(spacing: 4) {
                            Image(systemName: "clock")
                                .font(.caption)
                            Text(dl)
                                .font(.subheadline)
                        }
                        .foregroundColor(isOverdue(task.deadline) ? .red : .secondary)
                    }
                }
            }

            Spacer()

            HStack {
                Spacer()
                Text("Open app to manage tasks")
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
        }
        .padding(4)
    }

    // MARK: Empty state

    private var emptyView: some View {
        VStack(spacing: 8) {
            Image(systemName: "checkmark.circle")
                .font(.system(size: 32))
                .foregroundColor(accentColor)
            Text("No active tasks")
                .font(.subheadline)
                .foregroundColor(.secondary)
            Text("Open Privdo to add tasks")
                .font(.caption2)
                .foregroundColor(.secondary)
        }
        .padding()
    }

    // MARK: Helpers

    private func formattedDeadline(_ deadline: String?) -> String? {
        guard let dl = deadline else { return nil }
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

        // Try ISO 8601 first, then datetime-local format
        var date: Date?
        date = formatter.date(from: dl)
        if date == nil {
            let localFormatter = DateFormatter()
            localFormatter.dateFormat = "yyyy-MM-dd'T'HH:mm"
            date = localFormatter.date(from: dl)
        }

        guard let d = date else { return dl }
        let display = DateFormatter()
        display.dateFormat = "MMM d, h:mm a"
        return display.string(from: d)
    }

    private func isOverdue(_ deadline: String?) -> Bool {
        guard let dl = deadline else { return false }
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd'T'HH:mm"
        guard let date = formatter.date(from: dl) else { return false }
        return date < Date()
    }
}

// MARK: – Widget Configuration

struct PrivdoWidget: Widget {
    let kind: String = "PrivdoWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: PrivdoTimelineProvider()) { entry in
            PrivdoWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("Privdo Task")
        .description("Shows your next task from Privdo.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}

// MARK: – Widget Bundle

@main
struct PrivdoWidgetBundle: WidgetBundle {
    var body: some Widget {
        PrivdoWidget()
    }
}

// MARK: – Preview

#if DEBUG
struct PrivdoWidget_Previews: PreviewProvider {
    static var previews: some View {
        PrivdoWidgetEntryView(entry: PrivdoEntry(
            date: Date(),
            task: WidgetTask(text: "Buy groceries for the week", completed: false, deadline: "2026-04-16T10:00")
        ))
        .previewContext(WidgetPreviewContext(family: .systemSmall))

        PrivdoWidgetEntryView(entry: PrivdoEntry(
            date: Date(),
            task: WidgetTask(text: "Finish quarterly report and send to manager", completed: false, deadline: "2026-04-16T14:30")
        ))
        .previewContext(WidgetPreviewContext(family: .systemMedium))

        PrivdoWidgetEntryView(entry: PrivdoEntry(
            date: Date(),
            task: WidgetTask(text: "Prepare presentation slides for the team meeting about the new product launch strategy", completed: false, deadline: "2026-04-17T09:00")
        ))
        .previewContext(WidgetPreviewContext(family: .systemLarge))
    }
}
#endif
