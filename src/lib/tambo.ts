/**
 * @file tambo.ts
 * @description Central configuration file for Tambo components and tools
 *
 * This file serves as the central place to register your Tambo components and tools.
 * It exports arrays that will be used by the TamboProvider.
 *
 * Read more about Tambo at https://tambo.co/docs
 */

import { Graph, graphSchema } from "@/components/tambo/graph";
import { DataCard, dataCardSchema } from "@/components/ui/card-data";
import { PinterestPinGrid, pinterestPinGridSchema } from "@/components/pinterest/pinterest-pin-grid";
import { PinterestBoardList, pinterestBoardListSchema } from "@/components/pinterest/pinterest-board-list";
import {
  getCountryPopulations,
  getGlobalPopulationTrend,
} from "@/services/population-stats";
import {
  searchPinterestPins,
  getUserBoards,
  getBoardPins,
} from "@/services/pinterest-service";
import type { TamboComponent } from "@tambo-ai/react";
import { TamboTool } from "@tambo-ai/react";
import { z } from "zod";
import { searchLibraryPins as searchLocalPins, scrollToLibraryPin as scrollPin, scrollLibraryToQuery } from "@/services/library-service";

/**
 * tools
 *
 * This array contains all the Tambo tools that are registered for use within the application.
 * Each tool is defined with its name, description, and expected props. The tools
 * can be controlled by AI to dynamically fetch data based on user interactions.
 */

export const tools: TamboTool[] = [
  {
    name: "countryPopulation",
    description:
      "A tool to get population statistics by country with advanced filtering options",
    tool: getCountryPopulations,
    toolSchema: z
      .function()
      .args(
        z
          .object({
            continent: z.string().optional(),
            sortBy: z.enum(["population", "growthRate"]).optional(),
            limit: z.number().optional(),
            order: z.enum(["asc", "desc"]).optional(),
          })
          .optional(),
      )
      .returns(
        z.array(
          z.object({
            countryCode: z.string(),
            countryName: z.string(),
            continent: z.enum([
              "Asia",
              "Africa",
              "Europe",
              "North America",
              "South America",
              "Oceania",
            ]),
            population: z.number(),
            year: z.number(),
            growthRate: z.number(),
          }),
        ),
      ),
  },
  {
    name: "searchLibraryPins",
    description:
      "Search the local cached library of pins (no API calls). Returns matching pins with metadata.",
    tool: searchLocalPins,
    toolSchema: z
      .function()
      .args(
        z.object({
          query: z.string().describe("Text to search in title, description or board name"),
          limit: z.number().optional(),
        }),
      )
      .returns(
        z.object({
          query: z.string(),
          pins: z.array(
            z.object({
              id: z.string(),
              title: z.string().nullable(),
              description: z.string().nullable(),
              imageUrl: z.string(),
              boardName: z.string().optional(),
              createdAt: z.string().optional(),
            }),
          ),
        }),
      ),
  },
  {
    name: "scrollToLibraryPin",
    description:
      "Scroll to a specific pin already rendered in the Library and highlight it.",
    tool: scrollPin,
    toolSchema: z
      .function()
      .args(
        z.object({
          pinId: z.string().describe("The Pinterest pin id to scroll to"),
          highlight: z.boolean().optional(),
        }),
      )
      .returns(z.object({ ok: z.literal(true) })),
  },
  {
    name: "scrollLibraryToQuery",
    description: "Search the local library for a query and auto-scroll to the best match (first result).",
    tool: scrollLibraryToQuery,
    toolSchema: z
      .function()
      .args(z.object({ query: z.string() }))
      .returns(z.object({ query: z.string(), matchCount: z.number(), firstPinId: z.string().optional() })),
  },
  {
    name: "globalPopulation",
    description:
      "A tool to get global population trends with optional year range filtering",
    tool: getGlobalPopulationTrend,
    toolSchema: z
      .function()
      .args(
        z
          .object({
            startYear: z.number().optional(),
            endYear: z.number().optional(),
          })
          .optional(),
      )
      .returns(
        z.array(
          z.object({
            year: z.number(),
            population: z.number(),
            growthRate: z.number(),
          }),
        ),
      ),
  },
  {
    name: "searchPinterestPins",
    description:
      "Search for Pinterest pins based on a query. Returns pins with images, titles, descriptions, and links.",
    tool: searchPinterestPins,
    toolSchema: z
      .function()
      .args(
        z.object({
          query: z.string().describe("Search query for Pinterest pins"),
          limit: z.number().optional().describe("Maximum number of pins to return (default: 25, max: 50)"),
        })
      )
      .returns(
        z.object({
          query: z.string(),
          pins: z.array(
            z.object({
              id: z.string(),
              title: z.string().nullable(),
              description: z.string().nullable(),
              imageUrl: z.string(),
              imageWidth: z.number().optional(),
              imageHeight: z.number().optional(),
              link: z.string().nullable(),
              boardName: z.string().optional(),
              createdAt: z.string(),
              isVideo: z.boolean().optional(),
            })
          ),
        })
      ),
  },
  {
    name: "getUserBoards",
    description:
      "Get the user's Pinterest boards with metadata including names, descriptions, and pin counts.",
    tool: getUserBoards,
    toolSchema: z
      .function()
      .args(
        z
          .object({
            limit: z.number().optional().describe("Maximum number of boards to return (default: 25, max: 100)"),
          })
          .optional()
      )
      .returns(
        z.object({
          boards: z.array(
            z.object({
              id: z.string(),
              name: z.string(),
              description: z.string().nullable(),
              pinCount: z.number(),
              createdAt: z.string(),
            })
          ),
        })
      ),
  },
  {
    name: "getBoardPins",
    description:
      "Get pins from a specific Pinterest board by board ID.",
    tool: getBoardPins,
    toolSchema: z
      .function()
      .args(
        z.object({
          boardId: z.string().describe("The ID of the Pinterest board"),
          limit: z.number().optional().describe("Maximum number of pins to return (default: 25, max: 100)"),
        })
      )
      .returns(
        z.object({
          boardId: z.string(),
          pins: z.array(
            z.object({
              id: z.string(),
              title: z.string().nullable(),
              description: z.string().nullable(),
              imageUrl: z.string(),
              imageWidth: z.number().optional(),
              imageHeight: z.number().optional(),
              link: z.string().nullable(),
              boardName: z.string().optional(),
              createdAt: z.string(),
              isVideo: z.boolean().optional(),
            })
          ),
        })
      ),
  },
  // Add more tools here
];

/**
 * components
 *
 * This array contains all the Tambo components that are registered for use within the application.
 * Each component is defined with its name, description, and expected props. The components
 * can be controlled by AI to dynamically render UI elements based on user interactions.
 */
export const components: TamboComponent[] = [
  {
    name: "Graph",
    description:
      "A component that renders various types of charts (bar, line, pie) using Recharts. Supports customizable data visualization with labels, datasets, and styling options.",
    component: Graph,
    propsSchema: graphSchema,
  },
  {
    name: "DataCard",
    description:
      "A component that displays options as clickable cards with links and summaries with the ability to select multiple items.",
    component: DataCard,
    propsSchema: dataCardSchema,
  },
  {
    name: "PinterestPinGrid",
    description:
      "A component that displays Pinterest pins in a masonry-style grid layout. Shows images, titles, descriptions, and metadata in an interactive Pinterest-style interface.",
    component: PinterestPinGrid,
    propsSchema: pinterestPinGridSchema,
  },
  {
    name: "PinterestBoardList",
    description:
      "A component that displays Pinterest boards as cards with previews, names, descriptions, and pin counts. Provides an overview of user's Pinterest boards.",
    component: PinterestBoardList,
    propsSchema: pinterestBoardListSchema,
  },
  // Add more components here
];
