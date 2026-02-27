import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { Provider } from 'react-redux';
import { store } from './src/redux/store';
import { StatusBar } from 'expo-status-bar';

import ConnectionScreen from './src/screens/ConnectionScreen';
import WebViewScreen from './src/screens/WebViewScreen';

import * as NavigationBar from 'expo-navigation-bar';
import { Platform } from 'react-native';

const Stack = createStackNavigator();

export default function App() {
  React.useEffect(() => {
    if (Platform.OS === 'android') {
      // Hide navigation bar but keep status bar visible
      NavigationBar.setVisibilityAsync('hidden');
      NavigationBar.setBehaviorAsync('inset-touch');
    }
  }, []);

  return (
    <Provider store={store}>
      <NavigationContainer>
        <StatusBar hidden={true} />
        <Stack.Navigator initialRouteName="Connection">
          <Stack.Screen
            name="Connection"
            component={ConnectionScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="WebView"
            component={WebViewScreen}
            options={{ headerShown: false }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </Provider>
  );
}
