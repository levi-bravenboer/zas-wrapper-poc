## MODIFIED Requirements

### Requirement: Restrained primitive set

The orchestrator SHALL provide a closed baseline of shadcn/ui primitives in `src/components/ui/`: `Alert`, `Avatar`, `Badge`, `Breadcrumb`, `Button`, `Card`, `Checkbox`, `Command`, `Dialog`, `DropdownMenu`, `Form`, `Icon`, `Input`, `Label`, `Select`, `Separator`, `Sheet`, `Sidebar`, `Skeleton`, `Switch`, `Table`, `Tabs`, `Textarea`, `Toast`, `Toaster`, `Tooltip`. Adding a primitive outside this set MUST be proposed as its own OpenSpec change. Higher-level shell components (`Shell`, `PageHeader`, state surfaces, `CommandPalette`, `DataTable`) MUST be built on top of these primitives — bespoke re-implementations of primitives in `node_modules` or shadcn are forbidden. The `DataTable` composite lives at `src/components/data-table/` and consumes the `Table` primitive; it is NOT itself a `ui/` primitive.

#### Scenario: Extending baseline gated

- **WHEN** a contributor adds a new file under `src/components/ui/` that is not in the baseline list
- **THEN** an OpenSpec change naming the new primitive MUST exist before the file is merged

#### Scenario: Primitives copied not re-exported

- **WHEN** a primitive is added
- **THEN** its source lives in `src/components/ui/<name>.tsx` (shadcn CLI lowercase / kebab filename, PascalCase named exports) and does not re-export raw Radix primitives from `@radix-ui/*`

#### Scenario: Higher-level components consume primitives

- **WHEN** the `Shell` is implemented
- **THEN** it composes `Sidebar`, `Sheet`, `DropdownMenu`, `Tooltip` from `@/components/ui/`
- **AND** does not duplicate their behavior with custom Radix wiring

#### Scenario: `DataTable` consumes the `Table` primitive

- **WHEN** the `DataTable` composite is implemented under `src/components/data-table/`
- **THEN** it imports `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell` from `@/components/ui/table`
- **AND** does NOT live under `src/components/ui/` itself
