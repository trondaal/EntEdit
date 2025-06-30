# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- `npm run dev` - Start development server with Vite
- `npm run build` - Build for production (runs TypeScript check first)
- `npm run lint` - Run ESLint
- `npm run preview` - Preview production build

## Architecture Overview

EntEdit is a React-based RDF/SPARQL entity editor that allows users to browse and edit semantic web data through a visual interface.

### Core Architecture

- **Frontend**: React + TypeScript + Vite application using Material-UI components
- **State Management**: TanStack Query for server state management and caching
- **SPARQL Integration**: Custom `SparqlClient` class for querying RDF triplestores
- **Default Endpoint**: Configured for GraphDB at `http://localhost:7200/repositories/EntEdit`

### Key Components Structure

1. **App.tsx** - Root component with theme provider and query client setup
2. **EntityBrowser** - Main interface with three-panel layout:
   - Left: RDF Classes browser
   - Center: Entities list for selected class  
   - Right: Entity editor form
3. **EntityEditor** - Form-based entity editing with property validation
4. **EndpointConfig** - SPARQL endpoint configuration component

### Data Flow

The application follows a hierarchical data flow:
1. User selects RDF class → triggers entity query for that class
2. User selects entity → loads entity properties for editing
3. Properties are dynamically rendered based on RDF schema (domain/range)
4. Updates are sent via SPARQL UPDATE queries

### SPARQL Query Patterns

- Uses OWL ontology queries to discover classes and properties
- Queries both `owl:DatatypeProperty` and `owl:ObjectProperty`
- Filters properties by domain when a class is selected
- Supports both authenticated and anonymous endpoint access

### Authentication

Supports HTTP Basic Authentication for SPARQL endpoints via optional username/password configuration.