import React from 'react';
import { ActivityIndicator, FlatList, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { PREDICTION_TYPE_LABELS } from 'shared';
import { supabase } from '../lib/supabase';

const STATUS_LABEL: Record<string, string> = {
  published: 'Em aberto',
  pending_result: 'Aguardando',
  won: 'Green',
  lost: 'Red',
  voided: 'Anulado',
};

interface PredictionRow {
  id: string;
  prediction_type: string;
  prediction_value: string;
  odds: number;
  status: string;
  match: { home: { name: string } | null; away: { name: string } | null } | null;
  tipster: { username: string } | null;
}

async function fetchPredictions(): Promise<PredictionRow[]> {
  // Mesma query da web (app/palpites/page.tsx); RLS expõe publicados ao anon.
  const { data, error } = await supabase
    .from('predictions')
    .select(
      'id, prediction_type, prediction_value, odds, status, published_at, match:match_id(home:home_team_id(name), away:away_team_id(name)), tipster:tipster_id(username)',
    )
    .in('status', ['published', 'pending_result', 'won', 'lost', 'voided'])
    .order('published_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as unknown as PredictionRow[];
}

export function PredictionsScreen() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['predictions'],
    queryFn: fetchPredictions,
  });

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator color="#16a34a" />
      </View>
    );
  }

  if (isError) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-6">
        <Text className="text-red-600">Erro ao carregar palpites.</Text>
      </View>
    );
  }

  return (
    <FlatList
      className="flex-1 bg-white"
      contentContainerClassName="p-4 gap-3"
      data={data}
      keyExtractor={(item) => item.id}
      ListEmptyComponent={
        <Text className="text-gray-500">Nenhum palpite publicado ainda.</Text>
      }
      renderItem={({ item }) => (
        <View className="rounded border border-gray-200 p-3">
          <View className="mb-1 flex-row items-center justify-between">
            <Text className="font-medium text-gray-900">
              {item.match?.home?.name} x {item.match?.away?.name}
            </Text>
            <Text className="text-xs text-gray-500">
              {STATUS_LABEL[item.status] ?? item.status}
            </Text>
          </View>
          <Text className="text-sm text-gray-500">
            {PREDICTION_TYPE_LABELS[item.prediction_type] ?? item.prediction_type}:{' '}
            {item.prediction_value} · Odds {item.odds} · @{item.tipster?.username}
          </Text>
        </View>
      )}
    />
  );
}
