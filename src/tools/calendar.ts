import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { CalDavProvider } from "../providers/caldav.ts";

export function registerCalendarTools(
  server: McpServer,
  caldavProvider: CalDavProvider
) {
  server.tool(
    "list_calendars",
    "List all iCloud calendars (excludes Reminders/VTODO collections)",
    {},
    async () => {
      try {
        const calendars = await caldavProvider.listCalendars();
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ calendars }, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to list calendars: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "list_events",
    "List calendar events within a time range. Defaults to today if no range specified.",
    {
      calendar: z
        .string()
        .optional()
        .describe(
          "Calendar display name or URL (default: primary calendar)"
        ),
      start: z
        .string()
        .optional()
        .describe("Start of range (ISO 8601). Defaults to start of today."),
      end: z
        .string()
        .optional()
        .describe("End of range (ISO 8601). Defaults to end of today."),
      limit: z
        .number()
        .min(1)
        .max(200)
        .optional()
        .default(50)
        .describe("Maximum events to return (max 200)"),
    },
    async ({ calendar, start, end, limit }) => {
      try {
        const calendarUrl = await caldavProvider.resolveCalendarUrl(calendar);

        const now = new Date();
        const startDate = start
          ? new Date(start)
          : new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endDate = end
          ? new Date(end)
          : new Date(startDate.getTime() + 24 * 60 * 60 * 1000);

        const events = await caldavProvider.listEvents(
          calendarUrl,
          startDate,
          endDate
        );
        const limited = events.slice(0, limit);

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                { events: limited, total: events.length },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to list events: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "get_event",
    "Get full details of a calendar event by UID",
    {
      uid: z.string().describe("Event UID"),
      calendar: z
        .string()
        .optional()
        .describe(
          "Calendar display name or URL (default: primary calendar)"
        ),
    },
    async ({ uid, calendar }) => {
      try {
        const calendarUrl = await caldavProvider.resolveCalendarUrl(calendar);
        const event = await caldavProvider.getEvent(calendarUrl, uid);

        if (!event) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Event with UID "${uid}" not found`,
              },
            ],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(event, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to get event: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "create_event",
    "Create a new calendar event on iCloud Calendar",
    {
      summary: z.string().describe("Event title"),
      start: z.string().describe("Start time (ISO 8601)"),
      end: z.string().describe("End time (ISO 8601)"),
      calendar: z
        .string()
        .optional()
        .describe(
          "Calendar display name or URL (default: primary calendar)"
        ),
      location: z.string().optional().describe("Event location"),
      description: z.string().optional().describe("Event description"),
      attendees: z
        .array(z.string())
        .optional()
        .describe("Attendee email addresses"),
      isAllDay: z
        .boolean()
        .optional()
        .default(false)
        .describe("Whether this is an all-day event"),
    },
    async ({ summary, start, end, calendar, location, description, attendees, isAllDay }) => {
      try {
        const calendarUrl = await caldavProvider.resolveCalendarUrl(calendar);
        const event = await caldavProvider.createEvent(calendarUrl, {
          summary,
          start,
          end,
          location,
          description,
          attendees,
          isAllDay,
          calendar,
        });

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                { uid: event.uid, success: true, event },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to create event: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "delete_event",
    "Delete a calendar event by UID. Fetches the event internally to resolve the CalDAV object URL.",
    {
      uid: z.string().describe("Event UID"),
      calendar: z
        .string()
        .optional()
        .describe(
          "Calendar display name or URL (default: primary calendar)"
        ),
    },
    async ({ uid, calendar }) => {
      try {
        const calendarUrl = await caldavProvider.resolveCalendarUrl(calendar);
        await caldavProvider.deleteEvent(calendarUrl, uid);

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ success: true }, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to delete event: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
