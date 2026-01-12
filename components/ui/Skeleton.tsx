/**
 * Skeleton Loading Components
 * Content-shaped placeholders that display while data is loading.
 * Much more native-feeling than spinners - shows the shape of what's coming.
 */

import React from 'react';

interface SkeletonProps {
  className?: string;
}

/**
 * Base skeleton element - animated gray placeholder
 */
export const Skeleton: React.FC<SkeletonProps> = ({ className = '' }) => (
  <div className={`animate-pulse bg-muted rounded-lg ${className}`} />
);

/**
 * Circle skeleton - for avatars
 */
export const SkeletonCircle: React.FC<{ size?: string }> = ({ size = 'w-10 h-10' }) => (
  <div className={`animate-pulse bg-muted rounded-full ${size}`} />
);

/**
 * Text line skeleton - for text content
 */
export const SkeletonText: React.FC<{ width?: string }> = ({ width = 'w-full' }) => (
  <div className={`animate-pulse bg-muted rounded h-4 ${width}`} />
);

// ─────────────────────────────────────────────────────────────────
// PAGE-SPECIFIC SKELETONS
// ─────────────────────────────────────────────────────────────────

/**
 * Meal Card Skeleton - matches the real meal card layout
 */
export const MealCardSkeleton: React.FC = () => (
  <div className="rounded-xl border border-border bg-card overflow-hidden">
    <div className="flex divide-x divide-border min-h-[100px]">
      {/* LEFT: Dish Section Skeleton */}
      <div className="flex-1 p-3 flex flex-col">
        {/* Audience badge */}
        <Skeleton className="h-5 w-16 rounded-full mb-2" />
        {/* Dish name */}
        <Skeleton className="h-4 w-3/4 mb-1" />
        <Skeleton className="h-4 w-1/2 mb-2" />
        {/* Edit button */}
        <Skeleton className="h-3 w-14 mt-auto" />
      </div>
      
      {/* RIGHT: Who's Eating Section Skeleton */}
      <div className="flex-1 p-3 flex flex-col">
        {/* Header */}
        <Skeleton className="h-4 w-20 mb-2" />
        {/* Avatar placeholders */}
        <div className="flex gap-1.5 mb-2 flex-1">
          <SkeletonCircle size="w-7 h-7" />
          <SkeletonCircle size="w-7 h-7" />
          <SkeletonCircle size="w-7 h-7" />
        </div>
        {/* Join button */}
        <Skeleton className="h-7 w-full rounded-full" />
      </div>
    </div>
  </div>
);

/**
 * Meal Slot Skeleton - a full meal time section (e.g., Breakfast)
 */
export const MealSlotSkeleton: React.FC = () => (
  <div className="space-y-3">
    {/* Meal type header */}
    <div className="flex items-center gap-2">
      <Skeleton className="w-5 h-5 rounded" />
      <Skeleton className="h-4 w-20" />
    </div>
    <MealCardSkeleton />
  </div>
);

/**
 * ToDo Item Skeleton - matches shopping/task list items
 */
export const ToDoItemSkeleton: React.FC = () => (
  <div className="flex items-center gap-3 p-4 bg-card rounded-xl">
    {/* Checkbox */}
    <SkeletonCircle size="w-6 h-6" />
    {/* Content */}
    <div className="flex-1 space-y-1.5">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-1/3" />
    </div>
    {/* Avatar */}
    <SkeletonCircle size="w-8 h-8" />
  </div>
);

/**
 * ToDo List Skeleton - multiple items
 */
export const ToDoListSkeleton: React.FC<{ count?: number }> = ({ count = 5 }) => (
  <div className="space-y-2">
    {Array.from({ length: count }).map((_, i) => (
      <ToDoItemSkeleton key={i} />
    ))}
  </div>
);

/**
 * Expense Item Skeleton
 */
export const ExpenseItemSkeleton: React.FC = () => (
  <div className="flex items-center gap-3 p-4 bg-card rounded-xl">
    {/* Category icon */}
    <Skeleton className="w-10 h-10 rounded-xl" />
    {/* Content */}
    <div className="flex-1 space-y-1.5">
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-3 w-1/4" />
    </div>
    {/* Amount */}
    <Skeleton className="h-5 w-16" />
  </div>
);

/**
 * Family Member Card Skeleton - for Home carousel
 */
export const FamilyMemberSkeleton: React.FC = () => (
  <div className="flex flex-col items-center gap-2 w-20">
    <SkeletonCircle size="w-16 h-16" />
    <Skeleton className="h-3 w-14" />
    <Skeleton className="h-4 w-12 rounded-full" />
  </div>
);

/**
 * Home Card Skeleton - for summary cards
 */
export const HomeCardSkeleton: React.FC = () => (
  <div className="bg-card rounded-2xl p-6 space-y-4">
    <div className="flex items-center justify-between">
      <Skeleton className="h-5 w-24" />
      <Skeleton className="w-8 h-8 rounded-full" />
    </div>
    <div className="space-y-2">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  </div>
);

/**
 * Place Card Skeleton
 */
export const PlaceCardSkeleton: React.FC = () => (
  <div className="bg-card rounded-2xl p-5 space-y-3">
    <div className="flex items-center gap-3">
      <SkeletonCircle size="w-12 h-12" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-3 w-1/3" />
      </div>
    </div>
    <div className="space-y-2">
      <div className="flex gap-1.5">
        <Skeleton className="h-6 w-16 rounded-full" />
        <Skeleton className="h-6 w-20 rounded-full" />
        <Skeleton className="h-6 w-14 rounded-full" />
      </div>
    </div>
  </div>
);

export default Skeleton;

