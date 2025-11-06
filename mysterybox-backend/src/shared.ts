import { defineSignal, defineQuery } from '@temporalio/workflow';

// --- Data Types for Signals ---

export type CrisisDecision = {
  choice: string; // e.g., "SWEDEN"
  cost: string;
  days: string;
};

export type LabDecision = {
  choice: string; // e.g., "EUROPE_SUPPLIER"
  cost: string;
  delayWeeks: string;
  risk?: string;
};

// --- Signal Definitions ---

export const crisisDecisionSignal = defineSignal<[CrisisDecision]>('crisisDecision');
export const labDecisionSignal = defineSignal<[LabDecision]>('labDecision');

// --- Query Definition ---

/**
 * A query to get the current status of the workflow,
 * which the frontend can poll.
 */
export const statusQuery = defineQuery<string>('status');