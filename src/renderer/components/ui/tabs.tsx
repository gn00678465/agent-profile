import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cn } from '@/lib/utils';

const Tabs = TabsPrimitive.Root;

function TabsList({ className, ref, ...props }: React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> & { ref?: React.Ref<React.ElementRef<typeof TabsPrimitive.List>> }) {
  return (
    <TabsPrimitive.List
      ref={ref}
      className={cn(
        'inline-flex h-auto items-center justify-start border-b-[1px] border-b-[var(--border-subtle)] bg-transparent p-0 text-muted-foreground',
        className
      )}
      {...props}
    />
  );
}
TabsList.displayName = TabsPrimitive.List.displayName;

function TabsTrigger({ className, ref, ...props }: React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger> & { ref?: React.Ref<React.ElementRef<typeof TabsPrimitive.Trigger>> }) {
  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap border-b-2 border-transparent px-3 py-1.5 text-sm font-medium text-muted-foreground ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none',
        className
      )}
      {...props}
    />
  );
}
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

function TabsContent({ className, ref, ...props }: React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content> & { ref?: React.Ref<React.ElementRef<typeof TabsPrimitive.Content>> }) {
  return (
    <TabsPrimitive.Content
      ref={ref}
      className={cn(
        'mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        className
      )}
      {...props}
    />
  );
}
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
