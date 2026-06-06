import React, { useState } from 'react';
import { Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { loginSchema } from 'shared';
import { supabase } from '../lib/supabase';

export function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      Alert.alert('Dados inválidos', parsed.error.issues[0].message);
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    setLoading(false);
    if (error) {
      Alert.alert('Erro ao entrar', error.message);
    }
    // Sucesso: o listener em RootNavigator troca para as tabs automaticamente.
  }

  return (
    <View className="flex-1 justify-center gap-4 bg-white px-6">
      <Text className="mb-2 text-2xl font-bold text-gray-900">Entrar</Text>

      <TextInput
        className="rounded border border-gray-300 px-3 py-3 text-gray-900"
        placeholder="E-mail"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        className="rounded border border-gray-300 px-3 py-3 text-gray-900"
        placeholder="Senha"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <TouchableOpacity
        className="mt-2 rounded bg-green-600 py-3"
        disabled={loading}
        onPress={handleLogin}
      >
        <Text className="text-center font-semibold text-white">
          {loading ? 'Entrando...' : 'Entrar'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
