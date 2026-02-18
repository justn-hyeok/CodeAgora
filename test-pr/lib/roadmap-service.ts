/**
 * Roadmap Service - CRUD operations for roadmap management
 *
 * INTENTIONAL ISSUES:
 * - Security: IDOR vulnerability (userId from client body)
 * - HC: Hard delete with cascade (data loss)
 * - Strict: Missing error handling, type safety violations
 */

import { db } from '@/lib/db';

// ❌ Security Issue: userId from client body (IDOR)
// ❌ Strict Issue: any return type
export async function getRoadmap(req: any) {
  const { userId, roadmapId } = req.body; // Client controls userId!

  // ❌ Strict Issue: No try-catch, no error handling
  const roadmap = await db.roadmap.findUnique({
    where: { id: roadmapId },
    include: {
      learningRecords: true,
      milestones: true
    }
  });

  // ❌ Strict Issue: No validation that roadmap belongs to userId
  return roadmap;
}

// ❌ HC Issue: Hard delete with cascade - irreversible data loss
export async function deleteRoadmap(roadmapId: string) {
  // No soft delete, no backup, no confirmation
  // This will cascade delete all learningRecords and milestones
  const result = await db.roadmap.delete({
    where: { id: roadmapId }
  });

  return { success: true };
}

// ❌ Strict Issue: Inconsistent error handling
export async function createRoadmap(data: any) {
  try {
    const roadmap = await db.roadmap.create({
      data: {
        title: data.title,
        userId: data.userId,
        // ❌ Strict Issue: No validation of required fields
      }
    });

    return roadmap;
  } catch (error) {
    // ❌ Strict Issue: Always returns 500, no specific error codes
    throw new Error('Failed to create roadmap');
  }
}

// ❌ Strict Issue: Type assertion instead of proper typing
export async function updateRoadmap(roadmapId: string, updates: any) {
  const roadmap = await db.roadmap.update({
    where: { id: roadmapId },
    data: updates
  }) as any; // Type assertion abuse

  return roadmap;
}
