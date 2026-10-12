import app from "@/config/app.json";
import prices from "@/config/prices.json";
import limits from "@/config/limits.json";
import legal from "@/config/legal.json";
import markets from "@/config/markets.json";

// Every price, limit and list is versioned config. Import from here, never hard code.
export const APP = app;
export const PRICES = prices;
export const LIMITS = limits;
export const LEGAL = legal;
export const MARKETS = markets;
export const APP_NAME = app.APP_NAME;
