export const lightTheme = {
  mode: "light" as const,
  colors: {
    background: "#FFFFFF",
    surface: "#F4F5F7",
    primary: "#C8102E", // CNN-style red for breaking/brand accents
    primaryMuted: "#FCE8EA",
    text: "#14171A",
    textSecondary: "#5B6470",
    border: "#E4E6EB",
    success: "#1E8E3E",
    warning: "#B8860B",
    error: "#D93025",
    breakingBanner: "#C8102E",
    featuredBadge: "#0B5FFF",
  },
};

export const darkTheme = {
  mode: "dark" as const,
  colors: {
    background: "#0F1114",
    surface: "#1A1D21",
    primary: "#FF3B4E",
    primaryMuted: "#3A1418",
    text: "#F2F3F5",
    textSecondary: "#9AA1AC",
    border: "#2A2D31",
    success: "#4CAF50",
    warning: "#E0A800",
    error: "#FF5449",
    breakingBanner: "#FF3B4E",
    featuredBadge: "#4C8CFF",
  },
};

export type Theme = typeof lightTheme;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 };
export const radius = { sm: 6, md: 12, lg: 20, pill: 999 };
