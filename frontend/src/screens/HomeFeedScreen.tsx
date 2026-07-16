import React, { useCallback } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Image } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../hooks/useTheme";
import { useScriptAwareStyle } from "../hooks/useScriptAwareStyle";
import { useGetFeedQuery, useGetCategoriesQuery } from "../store/api";
import { spacing, radius } from "../theme";

const CATEGORY_KEYS = ["politics", "local", "world", "sports", "tech", "entertainment"] as const;

export default function HomeFeedScreen({ navigation }: any) {
  const { t } = useTranslation(["feed", "common"]);
  const theme = useTheme();
  const { data: feed, isLoading, refetch } = useGetFeedQuery({});
  const { data: categories } = useGetCategoriesQuery();

  const renderArticle = useCallback(
    ({ item }: any) => <ArticleCard article={item} onPress={() => navigation.navigate("ArticleDetail", { id: item.id })} />,
    [navigation]
  );

  const breaking = feed?.items.find((a: any) => a.isBreaking);
  const trending = feed?.items.filter((a: any) => a.viewCount > 500).slice(0, 5) ?? [];

  return (
    <FlatList
      style={{ backgroundColor: theme.colors.background }}
      data={feed?.items ?? []}
      keyExtractor={(item) => item.id}
      renderItem={renderArticle}
      refreshing={isLoading}
      onRefresh={refetch}
      ListHeaderComponent={
        <View>
          {breaking && (
            <TouchableOpacity
              style={[styles.breakingBanner, { backgroundColor: theme.colors.breakingBanner }]}
              onPress={() => navigation.navigate("ArticleDetail", { id: breaking.id })}
            >
              <Text style={styles.breakingLabel}>{t("feed:breaking_news").toUpperCase()}</Text>
              <Text style={[styles.breakingTitle, useScriptAwareStyle(breaking.title, { baseFontSize: 18, weight: "700" })]} numberOfLines={2}>
                {breaking.title}
              </Text>
            </TouchableOpacity>
          )}

          <CategoryTabs categories={categories} navigation={navigation} />

          {trending.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>{t("feed:trending")}</Text>
              <FlatList
                horizontal
                data={trending}
                keyExtractor={(item) => `trend-${item.id}`}
                showsHorizontalScrollIndicator={false}
                renderItem={({ item }) => (
                  <TrendingCard article={item} onPress={() => navigation.navigate("ArticleDetail", { id: item.id })} />
                )}
              />
            </View>
          )}

          <Text style={[styles.sectionTitle, { color: theme.colors.text, marginTop: spacing.md }]}>{t("feed:for_you")}</Text>
        </View>
      }
      ListEmptyComponent={!isLoading ? <Text style={{ textAlign: "center", marginTop: spacing.xl }}>{t("feed:no_results")}</Text> : null}
    />
  );
}

function CategoryTabs({ categories, navigation }: any) {
  const { t } = useTranslation("feed");
  const theme = useTheme();
  return (
    <FlatList
      horizontal
      data={categories ?? CATEGORY_KEYS.map((k) => ({ slug: k }))}
      keyExtractor={(c: any) => c.slug}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ padding: spacing.sm }}
      renderItem={({ item }: any) => (
        <TouchableOpacity
          style={[styles.categoryChip, { borderColor: theme.colors.border }]}
          onPress={() => navigation.navigate("CategoryBrowse", { slug: item.slug })}
        >
          <Text style={{ color: theme.colors.text }}>{t(item.slug as any, item.nameEn ?? item.slug)}</Text>
        </TouchableOpacity>
      )}
    />
  );
}

function ArticleCard({ article, onPress }: any) {
  const theme = useTheme();
  const { t } = useTranslation("feed");
  const titleStyle = useScriptAwareStyle(article.title, { baseFontSize: 17, weight: "600" });

  return (
    <TouchableOpacity style={[styles.card, { backgroundColor: theme.colors.surface }]} onPress={onPress}>
      {article.thumbnailUrl && <Image source={{ uri: article.thumbnailUrl }} style={styles.cardImage} />}
      <View style={{ flex: 1, padding: spacing.sm }}>
        {article.isFeatured && (
          <View style={[styles.featuredBadge, { backgroundColor: theme.colors.featuredBadge }]}>
            <Text style={styles.featuredBadgeText}>★ Featured</Text>
          </View>
        )}
        <Text style={[titleStyle, { color: theme.colors.text }]} numberOfLines={3}>
          {article.title}
        </Text>
        <Text style={{ color: theme.colors.textSecondary, fontSize: 12, marginTop: 4 }}>
          {t("published_by", { name: article.author?.displayName })} · {t("views", { count: article.viewCount })}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function TrendingCard({ article, onPress }: any) {
  const theme = useTheme();
  const titleStyle = useScriptAwareStyle(article.title, { baseFontSize: 14, weight: "600" });
  return (
    <TouchableOpacity style={[styles.trendingCard, { backgroundColor: theme.colors.surface }]} onPress={onPress}>
      {article.thumbnailUrl && <Image source={{ uri: article.thumbnailUrl }} style={styles.trendingImage} />}
      <Text style={[titleStyle, { color: theme.colors.text, padding: spacing.xs }]} numberOfLines={2}>
        {article.title}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  breakingBanner: { margin: spacing.sm, padding: spacing.md, borderRadius: radius.md },
  breakingLabel: { color: "#fff", fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  breakingTitle: { color: "#fff", marginTop: 4 },
  section: { marginTop: spacing.md },
  sectionTitle: { fontSize: 18, fontWeight: "700", marginLeft: spacing.md, marginBottom: spacing.sm },
  categoryChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.pill, borderWidth: 1, marginRight: spacing.xs },
  card: { flexDirection: "row", margin: spacing.sm, borderRadius: radius.md, overflow: "hidden" },
  cardImage: { width: 100, height: 100 },
  featuredBadge: { alignSelf: "flex-start", paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.sm, marginBottom: 4 },
  featuredBadgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  trendingCard: { width: 160, marginLeft: spacing.md, borderRadius: radius.md, overflow: "hidden" },
  trendingImage: { width: 160, height: 90 },
});
