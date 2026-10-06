import { Request, Response } from 'express';
import { db } from '../config/db';
import { events } from '../config/schema';
import { gte, lte, and } from 'drizzle-orm';

async function findNearestSlot(
    participants: string[],
    durationMs: number,
    searchStart: Date
): Promise<{ suggestedStart: Date; suggestedEnd: Date }> {
    const allEvents = await db.select().from(events);

    const relevantEvents = allEvents
        .filter(e => e.participants.some(p => participants.includes(p)))
        .map(e => ({ start: new Date(e.startTime).getTime(), end: new Date(e.endTime).getTime() }))
        .sort((a, b) => a.start - b.start);

    let candidateStart = searchStart.getTime();

    for (const event of relevantEvents) {
        if (candidateStart + durationMs <= event.start) {
            break; 
        }
        if (candidateStart < event.end) {
            candidateStart = event.end; 
        }
    }

    return {
        suggestedStart: new Date(candidateStart),
        suggestedEnd: new Date(candidateStart + durationMs),
    };
}

export const createEvent = async (req: Request, res: Response) => {
    try {
        const { title, startTime, endTime, participants } = req.body;

        const newStart = new Date(startTime);
        const newEnd = new Date(endTime);
        const durationMs = newEnd.getTime() - newStart.getTime();
        const existingEvents = await db.select().from(events);
        const conflicts = existingEvents.filter((event) => {
            const eStart = new Date(event.startTime);
            const eEnd = new Date(event.endTime);
            const timeOverlap = newStart < eEnd && newEnd > eStart;
            const sharedParticipants = event.participants.filter((p) =>
                participants.includes(p)
            );

            return timeOverlap && sharedParticipants.length > 0;
        });
        if (conflicts.length > 0) {
            const conflictingDetails = conflicts.map((c) => ({
                eventId: c.id,
                eventTitle: c.title,
                conflictingParticipants: c.participants.filter((p) =>
                    participants.includes(p)
                ),
                startTime: c.startTime,
                endTime: c.endTime,
            }));
            const suggestion = await findNearestSlot(participants, durationMs, newStart);
            return res.status(409).json({
                message: 'Jadwal bentrok dengan event lain!',
                conflicts: conflictingDetails,
                suggestion: {
                    message: 'Slot waktu terdekat yang tersedia:',
                    startTime: suggestion.suggestedStart,
                    endTime: suggestion.suggestedEnd,
                },
            });
        }
        const [insertedEvent] = await db
            .insert(events)
            .values({
                title,
                startTime: newStart,
                endTime: newEnd,
                participants,
            })
            .returning();
            
        return res.status(201).json({
            message: 'Event berhasil dibuat',
            data: insertedEvent,
        });
    } catch (error) {
        return res.status(500).json({ message: 'Internal Server Error', error });
    }
};