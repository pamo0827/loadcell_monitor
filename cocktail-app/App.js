import React, { useState, useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, TouchableOpacity, Alert, ScrollView, Dimensions, TextInput, KeyboardAvoidingView, Platform, ImageBackground, Image, Animated } from 'react-native';
import { database } from './firebaseConfig';
import { ref, set, onValue, push } from 'firebase/database';
import { Audio } from 'expo-av';
import { WebView } from 'react-native-webview';

const SCREEN_HEIGHT = Dimensions.get('window').height;

const SOUND_ASSETS = {
  SPARKLE: require('./assets/sparkle.mp3'),
  EXPLOSION: require('./assets/explosion.mp3'),
  STEP_COMPLETE: require('./assets/step_complete.mp3'),
};

const STEPS = [
  {
    id: 1,
    label: 'オレンジジュース',
    detail: '黄色に光るまで注ぐ (40ml)',
    icon: '🍊',
    color: '#FFA500'
  },
  {
    id: 2,
    label: 'パイナップルジュース',
    detail: 'オレンジ〜赤に光るまで (40ml)',
    icon: '🍍',
    color: '#FFD700'
  },
  {
    id: 3,
    label: 'レモンジュース',
    detail: 'きらきら音が鳴るまで (10ml)',
    icon: '🍋',
    color: '#FFFACD'
  }
];

const FLUID_SIMULATION_URL = 'https://paveldogreat.github.io/WebGL-Fluid-Simulation/';
const INJECTED_JS = `
  (function() {
    // UI hiding
    function hideAllUI() {
      document.querySelectorAll('[class*="dg"]').forEach(el => {
        if (el.className && (el.className.includes('dg') || el.className === 'ac' || el.className === 'main')) {
          el.remove();
        }
      });
      document.querySelectorAll('div').forEach(div => {
        const hasCloseButton = div.querySelector('.close-button');
        const hasSaveRow = div.querySelector('.save-row');
        const hasController = div.querySelector('.controller');
        if (hasCloseButton || hasSaveRow || hasController) {
          div.remove();
        }
      });
      document.querySelectorAll('.github-corner, a[href*="github"], [class*="promo"]').forEach(el => el.remove());
    }

    const style = document.createElement('style');
    style.innerHTML = \`
      [class*="dg"], .dg, .dg.main, .dg.ac, .dg.a,
      div[style*="top: 0px"][style*="right: 15px"],
      div[style*="position: absolute"][style*="right: 0"],
      .close-button, .save-row, .controller, .property-name {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }
      canvas {
        display: block !important;
        position: absolute !important;
        top: 0 !important;
        left: 0 !important;
      }
    \`;
    document.head.appendChild(style);

    hideAllUI();
    setInterval(hideAllUI, 200);
  })();
  true;
`;

export default function App() {
  const [screen, setScreen] = useState('home'); // 'home', 'preparation', 'blending', 'result'
  const [isBlending, setIsBlending] = useState(false);
  const [isTaring, setIsTaring] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [score, setScore] = useState(0);
  const [totalWeight, setTotalWeight] = useState(0);
  const [sound, setSound] = useState(null);
  const [ranking, setRanking] = useState([]);
  const [nickname, setNickname] = useState('');
  const [hasSaved, setHasSaved] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  const lastPlayedRef = useRef(Date.now());

  // ランキングの監視
  useEffect(() => {
    const rankingRef = ref(database, 'cocktail/ranking');
    const unsubscribe = onValue(rankingRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const sortedRanking = Object.values(data)
          .sort((a, b) => b.score - a.score)
          .slice(0, 10);
        setRanking(sortedRanking);
      }
    });
    return () => unsubscribe();
  }, []);

  // サウンド再生の監視
  useEffect(() => {
    const soundRef = ref(database, 'cocktail/sound');
    const unsubscribe = onValue(soundRef, async (snapshot) => {
      const data = snapshot.val();
      if (data && data.timestamp && data.type) {
        // 古いイベントや既に再生したイベントは無視
        if (data.timestamp <= lastPlayedRef.current) return;
        // 10秒以上前のイベントも無視
        if (Date.now() - data.timestamp > 10000) return;

        lastPlayedRef.current = data.timestamp;

        const soundAsset = SOUND_ASSETS[data.type];
        if (soundAsset) {
          console.log(`🔊 Playing sound: ${data.type} (repeat: ${data.repeat})`);
          
          let playedCount = 0;
          const repeat = data.repeat || 1;

          const playOnce = async () => {
            if (playedCount >= repeat) return;
            
            try {
              const { sound: playbackObject } = await Audio.Sound.createAsync(
                soundAsset,
                { shouldPlay: true }
              );
              
              playbackObject.setOnPlaybackStatusUpdate(async (status) => {
                if (status.didJustFinish) {
                  await playbackObject.unloadAsync();
                  playedCount++;
                  if (playedCount < repeat) {
                    setTimeout(playOnce, 500);
                  }
                }
              });
            } catch (error) {
              console.error('Error playing sound:', error);
            }
          };

          playOnce();
        }
      }
    });

    return () => unsubscribe();
  }, []);

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
          setHasSaved(false); // Reset save state
          setNickname(''); // Reset nickname

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
      // WebGL Fluid Simulationを開始
      setIsAnimating(true);

      // リセット作業を開始
      await performReset();

      // WebGL Fluid Simulationの表示時間（2秒）
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Firebaseに「調合開始」の状態を書き込む
      await set(ref(database, 'cocktail/status'), {
        isBlending: true,
        isTaring: true,
        currentStep: 0,
        completed: false,
        timestamp: Date.now()
      });

      // 調合画面へ直接遷移
      setScreen('blending');
      setIsAnimating(false);
    } catch (error) {
      console.error('Error starting blend:', error);
      Alert.alert('エラー', '調合開始に失敗しました');
      setIsAnimating(false);
    }
  };

  // リセット処理
  const performReset = async () => {
    try {
      console.log('リセット作業開始...');

      // Firebaseの状態をリセット
      await set(ref(database, 'cocktail/status'), {
        isBlending: false,
        isTaring: false,
        currentStep: 0,
        completed: false,
        timestamp: Date.now()
      });

      console.log('リセット作業完了');
    } catch (error) {
      console.error('リセットエラー:', error);
    }
  };

  // スコア保存処理
  const handleSaveScore = async () => {
    if (!nickname.trim()) {
      Alert.alert('Please enter a nickname');
      return;
    }

    try {
      const rankingRef = ref(database, 'cocktail/ranking');
      const newScoreRef = push(rankingRef);
      await set(newScoreRef, {
        nickname: nickname.trim(),
        score: score,
        timestamp: Date.now()
      });
      setHasSaved(true);
      Alert.alert('Success', 'Score saved to Hall of Fame!');
      setScreen('home');
    } catch (error) {
      console.error('Error saving score:', error);
      Alert.alert('Error', 'Failed to save score');
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
        {/* WebGL Fluid Simulation - 演出用 */}
        {isAnimating && (
          <View style={styles.fluidAnimationContainer}>
            <WebView
              source={{ uri: FLUID_SIMULATION_URL }}
              style={styles.fluidWebView}
              injectedJavaScript={INJECTED_JS}
              scrollEnabled={false}
            />
          </View>
        )}

        {/* Content Overlay */}
        <View style={styles.overlay} pointerEvents="box-none">
          <ScrollView contentContainerStyle={styles.homeScrollContent}>
            
            <View style={styles.heroContainer}>
              <Image
                source={require('./assets/potion-icon.png')}
                style={[styles.heroGif, isAnimating && styles.heroGifAnimating]}
              />
              <Text style={styles.mainTitle}>POTION BAR</Text>
            </View>
            
            <View style={styles.bottomContainer}>
              <TouchableOpacity
                style={[styles.startButton, isAnimating && styles.startButtonDisabled]}
                onPress={handleStartBlending}
                disabled={isAnimating}
              >
                <Text style={styles.startButtonText}>
                  {isAnimating ? '準備中...' : '調合を始める'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* ランキングセクション */}
            <View style={styles.rankingContainer}>
              <Text style={styles.rankingTitle}>HALL OF FAME</Text>
              {ranking.map((item, index) => (
                <View key={index} style={styles.rankingRow}>
                  <Text style={styles.rankNumber}>{index + 1}.</Text>
                  <Text style={styles.rankName} numberOfLines={1}>{item.nickname}</Text>
                  <Text style={styles.rankScore}>{item.score}</Text>
                </View>
              ))}
              {ranking.length === 0 && (
                <Text style={styles.noRankingText}>No records yet.</Text>
              )}
            </View>
          </ScrollView>
        </View>
        <StatusBar style="light" />
      </View>
    );
  }

  // 調合中画面
  if (screen === 'blending') {
    return (
      <View style={styles.blendingContainer}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => setScreen('home')}
        >
          <Text style={styles.backButtonText}>← 前のページに戻る</Text>
        </TouchableOpacity>

        <ScrollView
          contentContainerStyle={styles.blendingContent}
          showsVerticalScrollIndicator={false}
        >

          {/* ステータス表示 */}
          {isTaring ? (
            <Text style={styles.bigStatusText}>システムを調整中...</Text>
          ) : currentStep === 0 ? (
            <View style={styles.bigStatusBox}>
              <Text style={styles.bigStatusText}>準備完了！</Text>
              <Text style={styles.bigStatusSubtext}>下記の手順で注いでください</Text>
            </View>
          ) : currentStep <= 3 ? (
            <View style={styles.bigStatusBox}>
              <Text style={styles.bigStatusText}>ステップ {currentStep}/3 進行中...</Text>
            </View>
          ) : (
            <View style={styles.bigStatusBox}>
              <Text style={styles.bigStatusText}>✨ すべてのステップが完了しました！✨</Text>
            </View>
          )}

          {/* ステップ1: オレンジジュース */}
          <View style={[styles.stepCard, currentStep === 1 && styles.stepCardActive]}>
            <View style={styles.stepHeader}>
              
              {currentStep >= 1 && <Text style={styles.stepStatus}>{currentStep > 1 ? '✓' : '⏳'}</Text>}
            </View>
            <Text style={styles.stepNumber}>STEP 1</Text>
            <Text style={styles.stepTitle}>オレンジジュース</Text>
            <Text style={styles.stepInstruction}>適量まで注げば、ポーションはオレンジ色に輝くでしょう。</Text>
          </View>

          {/* ステップ2: パイナップルジュース */}
          <View style={[styles.stepCard, currentStep === 2 && styles.stepCardActive]}>
            <View style={styles.stepHeader}>
              
              {currentStep >= 2 && <Text style={styles.stepStatus}>{currentStep > 2 ? '✓' : '⏳'}</Text>}
            </View>
            <Text style={styles.stepNumber}>STEP 2</Text>
            <Text style={styles.stepTitle}>パイナップルジュース</Text>
            <Text style={styles.stepInstruction}>適量まで注げば、ポーションは見事な黄色に輝くでしょう。</Text>
          </View>

          {/* ステップ3: レモンジュース */}
          <View style={[styles.stepCard, currentStep === 3 && styles.stepCardActive]}>
            <View style={styles.stepHeader}>
              {currentStep >= 3 && <Text style={styles.stepStatus}>{currentStep > 3 ? '✓' : '⏳'}</Text>}
            </View>
            <Text style={styles.stepNumber}>STEP 3</Text>
            <Text style={styles.stepTitle}>レモンジュース</Text>
            <Text style={styles.stepInstruction}>アクセントに少しだけ加えましょう。</Text>
          </View>

          {/* 錬成完了ボタン */}
          <Text style={styles.stepInstruction}>「浄化の音」が完璧な調合を知らせます。</Text>
          <TouchableOpacity
            style={styles.bigCompleteButton}
            onPress={() => {
              Alert.alert(
                '確認',
                'ポーションの錬成を完了しますか？',
                [
                  { text: 'キャンセル', style: 'cancel' },
                  {
                    text: '完了',
                    onPress: async () => {
                      await set(ref(database, 'cocktail/status/completed'), true);
                    }
                  }
                ]
              );
            }}
          >
            <Text style={styles.bigCompleteButtonText}>ポーション錬成を完了させる</Text>
          </TouchableOpacity>

          <Text style={styles.dangerStatusText}>DANGER：注ぎ過ぎると爆発します。</Text>

        </ScrollView>
        <StatusBar style="light" />
      </View>
    );
  }

  // 完了画面
  if (screen === 'result') {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => setScreen('home')}
        >
          <Text style={styles.backButtonText}>← 前のページに戻る</Text>
        </TouchableOpacity>

        <View style={styles.resultContainer}>
          <Text style={styles.congratsText}>お疲れ様です！</Text>
          
          <View style={styles.scoreCircle}>
            <Text style={styles.scoreLabel}>SCORE</Text>
            <Text style={styles.scoreValue}>{score}</Text>
          </View>

          <View style={styles.resultDetails}>
            <Text style={styles.resultDetailText}>{totalWeight.toFixed(1)}ml</Text>
            <Text style={styles.resultDetailText}>90mlでPerfect</Text>
          </View>

          {/* ニックネーム入力と保存 */}
          {!hasSaved ? (
            <View style={styles.saveContainer}>
              <Text style={styles.inputLabel}>ニックネームを入力してね</Text>
              <TextInput
                style={styles.input}
                placeholder="ｵﾁｱｲ"
                placeholderTextColor="#666"
                value={nickname}
                onChangeText={setNickname}
                maxLength={10}
              />
              <TouchableOpacity
                style={[styles.button, styles.saveButton]}
                onPress={handleSaveScore}
              >
                <Text style={styles.buttonText}>保存</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.skipButton}
                onPress={handleBackToHome}
              >
                <Text style={styles.skipButtonText}>戻る</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.homeButton}
              onPress={handleBackToHome}
            >
              <Text style={styles.homeButtonText}>Return to Title</Text>
            </TouchableOpacity>
          )}
        </View>
        <StatusBar style="light" />
      </KeyboardAvoidingView>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  fluidAnimationContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    backgroundColor: '#000',
  },
  fluidWebView: {
    flex: 1,
    backgroundColor: '#000',
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 15,
    zIndex: 1000,
    padding: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 8,
  },
  backButtonText: {
    color: '#AAA',
    fontSize: 12,
    fontWeight: '500',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  homeScrollContent: {
    padding: 30,
    alignItems: 'center',
    paddingBottom: 100,
    minHeight: SCREEN_HEIGHT,
    justifyContent: 'center',
  },
  heroContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  heroGif: {
    width: 150,
    height: 150,
    marginBottom: 10,
  },
  heroGifAnimating: {
    transform: [{ scale: 1.1 }],
  },
  mainTitle: {
    fontSize: 38,
    fontWeight: 'bold',
    color: '#FFD700',
    letterSpacing: 8,
    textShadowColor: 'rgba(255, 215, 0, 0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 15,
    marginTop: 10,
  },
  bottomContainer: {
    marginBottom: 60,
    alignItems: 'center',
    width: '100%',
  },
  startButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingVertical: 18,
    paddingHorizontal: 60,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  startButtonText: {
    color: '#FFD700',
    fontSize: 22,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  startButtonDisabled: {
    opacity: 0.5,
  },

  // Ranking Styles
  rankingContainer: {
    width: '100%',
    maxWidth: 350,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 0,
    padding: 20,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
  },
  rankingTitle: {
    fontSize: 16,
    color: '#AAA',
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 15,
    letterSpacing: 2,
  },
  rankingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  rankNumber: {
    color: '#FFD700',
    fontSize: 16,
    fontWeight: 'bold',
    width: 30,
  },
  rankName: {
    color: '#DDD',
    fontSize: 16,
    flex: 1,
    marginHorizontal: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  rankScore: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  noRankingText: {
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 10,
  },

  // Blending Styles
  blendingContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  blendingContent: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 80,
    paddingBottom: 40,
  },
  blendingBigTitle: {
    fontSize: 48,
    color: '#FFD700',
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 30,
    textShadowColor: 'rgba(255, 215, 0, 0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 15,
  },
  blendingPotionImage: {
    width: 150,
    height: 150,
    marginBottom: 30,
  },
  bigStatusBox: {
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    padding: 25,
    marginBottom: 30,
    width: '100%',
    alignItems: 'center',
  },
  bigStatusText: {
    fontSize: 28,
    color: '#ffb300ff',
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 50,
    marginBottom: 50,
  },
  bigStatusSubtext: {
    fontSize: 18,
    color: '#DDD',
    textAlign: 'center',
  },
  stepCard: {
    backgroundColor: 'rgba(0, 0, 0, 0)',
    padding: 30,
    marginBottom: 150,
    width: '100%',
    alignItems: 'center',
  },
  stepCardActive: {
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    borderColor: '#FFD700',
    borderWidth: 3,
  },
  stepHeader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    marginBottom: 40,
  },
  stepNumber: {
    fontSize: 50,
    color: '#ffb300ff',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  stepStatus: {
    position: 'absolute',
    top: 10,
    right: 10,
    fontSize: 28,
    color: '#FFD700',
  },
  stepPotionImage: {
    width: 300,
    height: 500,
    marginBottom: 20,
  },
  stepTitle: {
    fontSize: 32,
    color: '#FFF',
    fontWeight: 'bold',
    marginBottom: 50,
    marginTop: 50,
    textAlign: 'center',
  },
  stepAmount: {
    fontSize: 40,
    color: '#FFD700',
    fontWeight: 'bold',
    marginBottom: 10,
  },
  stepInstruction: {
    fontSize: 20,
    color: '#DDD',
    textAlign: 'center',
    lineHeight: 30,
  },
  bigCompleteButton: {
    backgroundColor: '#ffffff',
    paddingVertical: 25,
    paddingHorizontal: 40,
    borderRadius: 20,
    alignItems: 'center',
    width: '50%',
    marginTop: 20,
    elevation: 8,
  },
  bigCompleteButtonText: {
    color: '#000',
    fontSize: 26,
    fontWeight: 'bold',
    letterSpacing: 1,
  },

  // Result Styles
  resultContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#000',
  },
  congratsText: {
    fontSize: 40,
    color: '#FFF',
    fontWeight: 'bold',
    marginBottom: 40,
    fontStyle: 'italic',
  },
  scoreCircle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 4,
    borderColor: '#FFD700',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    marginBottom: 40,
  },
  scoreLabel: {
    fontSize: 20,
    color: '#AAA',
    letterSpacing: 2,
    marginBottom: 10,
  },
  scoreValue: {
    fontSize: 80,
    fontWeight: 'bold',
    color: '#FFD700',
  },
  resultDetails: {
    marginBottom: 40,
    alignItems: 'center',
  },
  resultDetailText: {
    color: '#DDD',
    fontSize: 18,
    marginBottom: 10,
  },
  saveContainer: {
    width: '100%',
    maxWidth: 300,
    alignItems: 'center',
  },
  inputLabel: {
    color: '#AAA',
    marginBottom: 10,
    fontSize: 16,
  },
  input: {
    backgroundColor: '#222',
    color: '#FFF',
    width: '100%',
    padding: 15,
    borderRadius: 10,
    fontSize: 18,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: '#444',
    marginBottom: 20,
  },

  dangerStatusText: {
    backgroundColor: '#FFD700',
    marginBottom: 15,
    color: '#000000ff',
    padding: 50,
    marginTop: 700,
    fontSize: 25,
  },

  saveButton: {
    backgroundColor: '#FFD700',
    width: '100%',
    marginBottom: 15,
  },
  button: {
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonText: {
    color: '#000',
    fontSize: 18,
    fontWeight: 'bold',
  },
  skipButton: {
    padding: 10,
  },
  skipButtonText: {
    color: '#666',
    fontSize: 14,
  },
  homeButton: {
    paddingVertical: 15,
    paddingHorizontal: 40,
    backgroundColor: '#333',
    borderRadius: 30,
  },
  homeButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
