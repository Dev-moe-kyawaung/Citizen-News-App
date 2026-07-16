import React, { useState } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, TextInput, Modal, Alert } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../hooks/useTheme";
import { useScriptAwareStyle } from "../hooks/useScriptAwareStyle";
import { useGetReviewQueueQuery, useApproveArticleMutation, useRejectArticleMutation } from "../store/api";
import { spacing, radius } from "../theme";

/** Editor/Admin screen: PENDING_REVIEW articles, approve or reject with a note. */
export default function ReviewQueueScreen({ navigation }: any) {
  const { t } = useTranslation(["editor", "admin"]);
  const theme = useTheme();
  const { data: queue, isLoading, refetch } = useGetReviewQueueQuery();
  const [approveArticle] = useApproveArticleMutation();
  const [rejectArticle] = useRejectArticleMutation();

  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  async function handleApprove(id: string) {
    try {
      await approveArticle(id).unwrap();
    } catch (e: any) {
      Alert.alert(t("editor:common:error_generic"), e?.data?.error?.message);
    }
  }

  async function handleConfirmReject() {
    if (!rejectTarget) return;
    try {
      await rejectArticle({ id: rejectTarget, note: rejectNote }).unwrap();
      setRejectTarget(null);
      setRejectNote("");
    } catch (e: any) {
      Alert.alert(t("editor:common:error_generic"), e?.data?.error?.message);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <FlatList
        data={queue ?? []}
        keyExtractor={(item) => item.id}
        refreshing={isLoading}
        onRefresh={refetch}
        contentContainerStyle={{ padding: spacing.md }}
        ListEmptyComponent={
          !isLoading ? <Text style={{ textAlign: "center", color: theme.colors.textSecondary }}>{t("admin:no_pending_articles")}</Text> : null
        }
        renderItem={({ item }) => (
          <QueueItem
            article={item}
            onApprove={() => handleApprove(item.id)}
            onReject={() => setRejectTarget(item.id)}
            onPress={() => navigation.navigate("ArticleDetail", { id: item.id, previewMode: true })}
          />
        )}
      />

      <Modal visible={!!rejectTarget} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.colors.surface }]}>
            <Text style={{ color: theme.colors.text, fontWeight: "700", marginBottom: spacing.sm }}>{t("editor:reject")}</Text>
            <TextInput
              style={[styles.noteInput, { borderColor: theme.colors.border, color: theme.colors.text }]}
              placeholder={t("editor:reject_reason_placeholder")}
              placeholderTextColor={theme.colors.textSecondary}
              value={rejectNote}
              onChangeText={setRejectNote}
              multiline
            />
            <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: spacing.sm, marginTop: spacing.sm }}>
              <TouchableOpacity onPress={() => setRejectTarget(null)}>
                <Text style={{ color: theme.colors.textSecondary }}>{t("editor:common:cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleConfirmReject}>
                <Text style={{ color: theme.colors.error, fontWeight: "700" }}>{t("editor:reject")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function QueueItem({ article, onApprove, onReject, onPress }: any) {
  const theme = useTheme();
  const titleStyle = useScriptAwareStyle(article.title, { baseFontSize: 16, weight: "600" });
  return (
    <TouchableOpacity style={[styles.item, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]} onPress={onPress}>
      <Text style={[titleStyle, { color: theme.colors.text }]} numberOfLines={2}>
        {article.title}
      </Text>
      <Text style={{ color: theme.colors.textSecondary, fontSize: 12, marginTop: 4 }}>
        {article.author?.displayName} · {article.category?.nameEn} · {new Date(article.submittedAt).toLocaleDateString()}
      </Text>
      <View style={{ flexDirection: "row", marginTop: spacing.sm, gap: spacing.sm }}>
        <TouchableOpacity style={[styles.pill, { backgroundColor: theme.colors.success }]} onPress={onApprove}>
          <Text style={styles.pillText}>✓ Approve</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.pill, { backgroundColor: theme.colors.error }]} onPress={onReject}>
          <Text style={styles.pillText}>✕ Reject</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  item: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },
  pill: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.pill },
  pillText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: spacing.lg },
  modalCard: { borderRadius: radius.md, padding: spacing.md },
  noteInput: { borderWidth: 1, borderRadius: radius.sm, padding: spacing.sm, minHeight: 80, textAlignVertical: "top" },
});
