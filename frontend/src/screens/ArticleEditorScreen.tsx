import React, { useState } from "react";
import { View, TextInput, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { useTranslation } from "react-i18next";
import { launchImageLibrary } from "react-native-image-picker";
import { useTheme } from "../hooks/useTheme";
import { useScriptAwareStyle } from "../hooks/useScriptAwareStyle";
import {
  useCreateArticleMutation,
  useUpdateArticleMutation,
  useSubmitForReviewMutation,
  useGetCategoriesQuery,
} from "../store/api";
import { useMediaUpload } from "../hooks/useMediaUpload";
import { RichTextEditor } from "../components/RichTextEditor";
import { CategoryPicker } from "../components/CategoryPicker";
import { TagInput } from "../components/TagInput";
import { spacing, radius } from "../theme";

/**
 * Create/edit screen for a Reporter's article. Handles the DRAFT lifecycle:
 * autosave-as-draft, media attach, and the final "submit for review" action
 * which hands the article off to the editorial workflow (backend-enforced).
 */
export default function ArticleEditorScreen({ route, navigation }: any) {
  const existingArticle = route.params?.article;
  const { t } = useTranslation("editor");
  const theme = useTheme();
  const { data: categories } = useGetCategoriesQuery();
  const { uploadMedia, uploadProgress } = useMediaUpload();

  const [title, setTitle] = useState(existingArticle?.title ?? "");
  const [subtitle, setSubtitle] = useState(existingArticle?.subtitle ?? "");
  const [bodyHtml, setBodyHtml] = useState(existingArticle?.bodyHtml ?? "");
  const [language, setLanguage] = useState<"EN" | "MY">(existingArticle?.language ?? "EN");
  const [categoryId, setCategoryId] = useState(existingArticle?.categoryId ?? categories?.[0]?.id);
  const [tags, setTags] = useState<string[]>(existingArticle?.tags?.map((t: any) => t.name) ?? []);
  const [mediaIds, setMediaIds] = useState<string[]>(existingArticle?.media?.map((m: any) => m.id) ?? []);
  const [saving, setSaving] = useState(false);

  const [createArticle] = useCreateArticleMutation();
  const [updateArticle] = useUpdateArticleMutation();
  const [submitForReview] = useSubmitForReviewMutation();

  const titleStyle = useScriptAwareStyle(title, { baseFontSize: 22, weight: "700" });

  async function persist(): Promise<string> {
    const payload = { title, subtitle, bodyHtml, language, categoryId, tags, mediaIds };
    if (existingArticle?.id) {
      await updateArticle({ id: existingArticle.id, ...payload }).unwrap();
      return existingArticle.id;
    }
    const created = await createArticle(payload).unwrap();
    return created.id;
  }

  async function handleSaveDraft() {
    if (!title.trim()) return Alert.alert(t("title_placeholder"));
    setSaving(true);
    try {
      await persist();
      navigation.goBack();
    } catch (e: any) {
      Alert.alert(t("common:error_generic"), e?.data?.error?.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmitForReview() {
    if (!title.trim() || !bodyHtml.trim()) return Alert.alert(t("title_placeholder"));
    setSaving(true);
    try {
      const id = await persist();
      await submitForReview(id).unwrap();
      Alert.alert(t("submit_for_review"), t("status_pending"));
      navigation.goBack();
    } catch (e: any) {
      Alert.alert(t("common:error_generic"), e?.data?.error?.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleAddMedia() {
    const result = await launchImageLibrary({ mediaType: "mixed", quality: 0.9 });
    const asset = result.assets?.[0];
    if (!asset?.uri) return;
    const media = await uploadMedia(asset);
    if (media) setMediaIds((prev) => [...prev, media.id]);
  }

  return (
    <ScrollView style={{ backgroundColor: theme.colors.background }} contentContainerStyle={styles.container}>
      {/* Language toggle for the article being authored */}
      <View style={styles.langToggle}>
        {(["EN", "MY"] as const).map((lang) => (
          <TouchableOpacity
            key={lang}
            style={[styles.langChip, { borderColor: theme.colors.border }, language === lang && { backgroundColor: theme.colors.primaryMuted }]}
            onPress={() => setLanguage(lang)}
          >
            <Text style={{ color: theme.colors.text }}>{lang === "EN" ? "English" : "မြန်မာ"}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TextInput
        style={[styles.titleInput, titleStyle, { color: theme.colors.text }]}
        placeholder={t("title_placeholder")}
        placeholderTextColor={theme.colors.textSecondary}
        value={title}
        onChangeText={setTitle}
        multiline
      />
      <TextInput
        style={[styles.subtitleInput, { color: theme.colors.textSecondary }]}
        placeholder={t("subtitle_placeholder")}
        placeholderTextColor={theme.colors.textSecondary}
        value={subtitle}
        onChangeText={setSubtitle}
        multiline
      />

      <CategoryPicker categories={categories} value={categoryId} onChange={setCategoryId} />
      <TagInput tags={tags} onChange={setTags} placeholder={t("add_tags")} />

      <RichTextEditor value={bodyHtml} onChange={setBodyHtml} placeholder={t("body_placeholder")} language={language} />

      <TouchableOpacity style={[styles.mediaButton, { borderColor: theme.colors.border }]} onPress={handleAddMedia}>
        <Text style={{ color: theme.colors.primary }}>+ {t("add_media")}</Text>
      </TouchableOpacity>
      {uploadProgress > 0 && uploadProgress < 100 && (
        <Text style={{ color: theme.colors.textSecondary }}>{t("uploading_media")} {uploadProgress}%</Text>
      )}
      {mediaIds.length > 0 && <Text style={{ color: theme.colors.textSecondary }}>{mediaIds.length} attached</Text>}

      <View style={styles.actionRow}>
        <TouchableOpacity style={[styles.actionButton, { borderColor: theme.colors.border }]} onPress={handleSaveDraft} disabled={saving}>
          <Text style={{ color: theme.colors.text }}>{t("save_draft")}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.primaryAction, { backgroundColor: theme.colors.primary }]}
          onPress={handleSubmitForReview}
          disabled={saving}
        >
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "700" }}>{t("submit_for_review")}</Text>}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.md, paddingBottom: spacing.xxl },
  langToggle: { flexDirection: "row", marginBottom: spacing.sm },
  langChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.pill, borderWidth: 1, marginRight: spacing.sm },
  titleInput: { minHeight: 60, textAlignVertical: "top" },
  subtitleInput: { fontSize: 15, minHeight: 40, textAlignVertical: "top", marginBottom: spacing.sm },
  mediaButton: { borderWidth: 1, borderStyle: "dashed", borderRadius: radius.md, padding: spacing.md, alignItems: "center", marginVertical: spacing.sm },
  actionRow: { flexDirection: "row", marginTop: spacing.lg, gap: spacing.sm },
  actionButton: { flex: 1, borderWidth: 1, borderRadius: radius.md, padding: spacing.md, alignItems: "center" },
  primaryAction: { borderWidth: 0 },
});
