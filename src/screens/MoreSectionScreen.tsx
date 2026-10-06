import React from 'react';
import { Pressable, Text } from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import { TaxesScreen } from './TaxesScreen';
import { AppScreen } from '../components/POSUI';
import { RootStackParamList } from '../navigation/AppNavigator';
import { usePOS } from '../hooks/usePOS';
import { AppearanceMode } from '../models/pos';
import { DeveloperTerminalPanel } from './DeveloperTerminalPanel';
import { useAppTheme } from '../theme';

type MoreSectionRoute = RouteProp<RootStackParamList, 'MoreSection'>;

export function MoreSectionScreen() {
 const {params}=useRoute<MoreSectionRoute>();const theme=useAppTheme();const {state,updateAppearanceMode}=usePOS();
 if(params.section==='hardware')return <AppScreen hideStripeSetupNotice title="Readers" subtitle="Connect a reader or configure Android Tap to Pay."><DeveloperTerminalPanel/></AppScreen>;
 if(params.section==='taxes')return <TaxesScreen/>;
 if(params.section==='appearance')return <AppScreen title="Appearance" subtitle="Choose the display style for this register.">{(['system','light','dark'] as AppearanceMode[]).map(mode=><Pressable accessibilityRole="radio" accessibilityState={{checked:state.settings.appearanceMode===mode}} key={mode} onPress={()=>updateAppearanceMode(mode)} style={{minHeight:56,padding:16,borderRadius:12,backgroundColor:state.settings.appearanceMode===mode?theme.colors.accentSoft:theme.colors.surface}}><Text style={{color:theme.colors.text,fontSize:16}}>{mode==='system'?'Use device setting':mode==='light'?'Light':'Dark'}</Text></Pressable>)}</AppScreen>;
 return <AppScreen title="Register diagnostics" subtitle="Connection and reader diagnostics are available in their settings screens."/>;
}
