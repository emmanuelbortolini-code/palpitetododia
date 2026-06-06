import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabase';

export function HomeScreen() {
  return (
    <View className="flex-1 justify-center gap-4 bg-white px-6">
      <Text className="text-2xl font-bold text-gray-900">PalpiteTodoDia</Text>
      <Text className="text-gray-500">
        Bem-vindo! Use a aba Palpites para ver os palpites publicados.
      </Text>

      <TouchableOpacity
        className="mt-4 self-start rounded border border-gray-300 px-4 py-2"
        onPress={() => supabase.auth.signOut()}
      >
        <Text className="text-gray-700">Sair</Text>
      </TouchableOpacity>
    </View>
  );
}
