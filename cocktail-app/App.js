import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, TouchableOpacity, Alert } from 'react-native';
import { database } from './firebaseConfig';
import { ref, set, onValue } from 'firebase/database';
import { Audio } from 'expo-av';

export default function App() {
  const [screen, setScreen] = useState('home'); // 'home', 'blending', 'result'
  const [isBlending, setIsBlending] = useState(false);
  const [isTaring, setIsTaring] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [score, setScore] = useState(0);
  const [totalWeight, setTotalWeight] = useState(0);
  const [sound, setSound] = useState(null);

  // BGMを再生
  useEffect(() => {
    let bgmSound = null;

    async function loadAndPlayBGM() {
      try {
        // 音声モードを設定
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
        });

        // BGMをロード
        const { sound } = await Audio.Sound.createAsync(
          require('./魔力に満ちた部屋.mp3'),
          { shouldPlay: true, isLooping: true, volume: 0.5 }
        );

        bgmSound = sound;
        setSound(sound);
        console.log('BGM再生開始');
      } catch (error) {
        console.error('BGM再生エラー:', error);
      }
    }

    loadAndPlayBGM();

    // クリーンアップ
    return () => {
      if (bgmSound) {
        console.log('BGM停止');
        bgmSound.unloadAsync();
      }
    };
  }, []);

  // Firebaseのステータスをリアルタイムで監視
  useEffect(() => {
    const statusRef = ref(database, 'cocktail/status');
    const unsubscribe = onValue(statusRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setIsBlending(data.isBlending || false);
        setIsTaring(data.isTaring || false);
        setCurrentStep(data.currentStep || 0);

        // 調合完了を検知
        if (data.completed && screen === 'blending') {
          setScore(data.score || 0);
          setTotalWeight(data.totalWeight || 0);
          setScreen('result');

          // completedフラグをリセット
          set(ref(database, 'cocktail/status/completed'), false);
        }
      }
    });

    return () => unsubscribe();
  }, [screen]);

  // 調合開始ボタンの処理
  const handleStartBlending = async () => {
    try {
      // Firebaseに「調合開始」の状態を書き込む
      await set(ref(database, 'cocktail/status'), {
        isBlending: true,
        isTaring: true,
        currentStep: 0,
        completed: false,
        timestamp: Date.now()
      });
      setScreen('blending');
    } catch (error) {
      console.error('Error starting blend:', error);
      Alert.alert('エラー', '調合開始に失敗しました');
    }
  };

  // タイトルに戻る
  const handleBackToHome = () => {
    setScreen('home');
  };

  // ホーム画面
  if (screen === 'home') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>カクテルメーカー</Text>
        <Text style={styles.subtitle}>シンデレラ調合システム</Text>

        <TouchableOpacity
          style={[styles.button, styles.startButton]}
          onPress={handleStartBlending}
        >
          <Text style={styles.buttonText}>調合開始</Text>
        </TouchableOpacity>

        <StatusBar style="auto" />
      </View>
    );
  }

  // 調合中画面
  if (screen === 'blending') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>シンデレラ調合中</Text>

        {/* レシピ表示 */}
        <View style={styles.recipeContainer}>
          <Text style={styles.recipeTitle}>📖 レシピ</Text>
          <Text style={styles.recipeStep}>1. オレンジジュース：黄色に光るまで</Text>
          <Text style={styles.recipeStep}>2. パイナップルジュース：オレンジ〜赤に光るまで</Text>
          <Text style={styles.recipeStep}>3. レモンジュース：きらきら音が鳴るまで（90ml）</Text>
        </View>

        {/* ステータス表示 */}
        {isTaring && (
          <View style={styles.statusContainer}>
            <Text style={styles.statusText}>⚖️ リセットしています...</Text>
          </View>
        )}

        {isBlending && !isTaring && (
          <View style={styles.statusContainer}>
            <Text style={styles.statusText}>
              🍹 ステップ {currentStep}/3
            </Text>
          </View>
        )}

        <StatusBar style="auto" />
      </View>
    );
  }

  // 完了画面
  if (screen === 'result') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>🎉 調合完了！</Text>

        <View style={styles.resultContainer}>
          <Text style={styles.scoreLabel}>得点</Text>
          <Text style={styles.scoreValue}>{score}点</Text>
          <Text style={styles.weightText}>合計: {totalWeight.toFixed(1)}ml</Text>
        </View>

        <Text style={styles.thankYouText}>ありがとうございました！</Text>

        <TouchableOpacity
          style={[styles.button, styles.homeButton]}
          onPress={handleBackToHome}
        >
          <Text style={styles.buttonText}>タイトルに戻る</Text>
        </TouchableOpacity>

        <StatusBar style="auto" />
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 18,
    color: '#aaa',
    marginBottom: 50,
  },
  buttonContainer: {
    width: '100%',
    maxWidth: 300,
  },
  button: {
    padding: 20,
    borderRadius: 15,
    marginVertical: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  startButton: {
    backgroundColor: '#4CAF50',
  },
  finishButton: {
    backgroundColor: '#2196F3',
  },
  buttonDisabled: {
    backgroundColor: '#555',
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
  },
  statusContainer: {
    marginTop: 40,
    padding: 15,
    backgroundColor: '#333',
    borderRadius: 10,
  },
  statusText: {
    fontSize: 20,
    color: '#FFD700',
  },
  recipeContainer: {
    width: '100%',
    maxWidth: 350,
    backgroundColor: '#2a2a3e',
    padding: 20,
    borderRadius: 15,
    marginVertical: 20,
  },
  recipeTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFD700',
    marginBottom: 15,
    textAlign: 'center',
  },
  recipeStep: {
    fontSize: 16,
    color: '#ddd',
    marginVertical: 8,
    lineHeight: 24,
  },
  resultContainer: {
    alignItems: 'center',
    marginVertical: 40,
  },
  scoreLabel: {
    fontSize: 24,
    color: '#aaa',
    marginBottom: 10,
  },
  scoreValue: {
    fontSize: 80,
    fontWeight: 'bold',
    color: '#FFD700',
    marginBottom: 20,
  },
  weightText: {
    fontSize: 20,
    color: '#ddd',
  },
  thankYouText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginVertical: 30,
  },
  homeButton: {
    backgroundColor: '#6C63FF',
  },
});
