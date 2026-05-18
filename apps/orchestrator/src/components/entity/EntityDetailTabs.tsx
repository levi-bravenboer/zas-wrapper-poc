import type { ReactElement, ReactNode } from 'react'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export type EntityDetailTab = {
  value: string
  label: ReactNode
  content: ReactNode
}

export type EntityDetailTabsProps = {
  tabs: EntityDetailTab[]
  defaultValue?: string
  value?: string
  onValueChange?: (value: string) => void
}

export function EntityDetailTabs({
  tabs,
  defaultValue,
  value,
  onValueChange,
}: EntityDetailTabsProps): ReactElement {
  const resolvedDefault = defaultValue ?? tabs[0]?.value
  const controlled: {
    value?: string
    defaultValue?: string
    onValueChange?: (value: string) => void
  } = {}
  if (value !== undefined) controlled.value = value
  else if (resolvedDefault !== undefined) controlled.defaultValue = resolvedDefault
  if (onValueChange) controlled.onValueChange = onValueChange
  return (
    <Tabs {...controlled} className="flex flex-col gap-4">
      <TabsList>
        {tabs.map((tab) => (
          <TabsTrigger key={tab.value} value={tab.value}>
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map((tab) => (
        <TabsContent key={tab.value} value={tab.value}>
          {tab.content}
        </TabsContent>
      ))}
    </Tabs>
  )
}
