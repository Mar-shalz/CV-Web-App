import type { FilterType } from "./schema";

export const FILTER_LABELS: Record<FilterType, string> = {
  max_age: "Age limit",
  min_degree_class: "Class of degree",
  cgpa: "CGPA",
  degree_type: "Qualification",
  discipline: "Course of study",
  nysc: "NYSC",
  years_experience: "Years of experience",
  licence: "Licence or certification",
  location: "Location",
  olevel: "O level results",
  graduation_window: "Year of graduation",
  gender: "Gender",
  right_to_work: "Right to work",
};

export const CHANNEL_LABELS = {
  email: "By email",
  form: "Google Form or online form",
  portal: "Employer website or portal",
  whatsapp: "WhatsApp",
  in_person: "In person",
  unknown: "Not stated",
} as const;
