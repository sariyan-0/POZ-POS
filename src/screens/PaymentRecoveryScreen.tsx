import React,{useState} from 'react';
import { Pressable,Text,View } from 'react-native';
import { AppScreen } from '../components/POSUI';
import { apiClient } from '../services/api/ApiClient';
import { loadPaymentAttempts,removePaymentAttempt } from '../storage/persistence';
import { usePOS } from '../hooks/usePOS';
import { POSState } from '../models/pos';
import { useAppTheme } from '../theme';
export function PaymentRecoveryScreen({attempts,onResolved}:{attempts:Awaited<ReturnType<typeof loadPaymentAttempts>>;onResolved:()=>void}){
 const {createApprovedTransaction}=usePOS();const theme=useAppTheme();const[busy,setBusy]=useState(false);const[message,setMessage]=useState('Check the previous payment before starting another sale.');const[canCancel,setCancel]=useState(false);
 const attempt=attempts[0];
 async function check(cancel=false){if(busy)return;setBusy(true);try{
  const url=`/api/payments/attempts/${encodeURIComponent(attempt.id)}`;
  const response=cancel?await apiClient.post<{data:{status:string;paymentIntentId?:string;occurredAt?:string}}>(url,{}):await apiClient.get<{data:{status:string;paymentIntentId?:string;amount?:number;currency?:string;occurredAt?:string}}>(url);
  const status=response.data.status;
  if(status==='succeeded'&&'paymentIntentId' in response.data){
   const frozen=attempt.payload.state as POSState;
   const authorization=attempt.payload.authorization as {staffToken:string;approvalToken?:string}|undefined;
   if(!frozen||!authorization)throw new Error('The payment needs manager recovery. Its record is retained.');
   const data=response.data;
   if (!data.paymentIntentId || !data.occurredAt) throw new Error('Payment recovery information is incomplete.');
   const sale=await createApprovedTransaction({frozenState:frozen,authorization,occurredAt:data.occurredAt,paymentMethod:'card_reader',paymentProvider:'stripe_terminal',transactionReference:attempt.id,processorReference:data.paymentIntentId,paymentDetails:{paymentIntentId:data.paymentIntentId}});
   if(!sale)throw new Error('This approved payment needs sale recovery.');
   await removePaymentAttempt(attempt.id);onResolved();
  }else if(['canceled','not_started'].includes(status)){await removePaymentAttempt(attempt.id);onResolved();}
  else{setCancel(['requires_payment_method','requires_confirmation','requires_capture','unknown'].includes(status));setMessage(status==='unknown'?'The result is still unknown. Check again or request confirmed cancellation before starting another charge.':`Payment status: ${status.replace(/_/g,' ')}. Check again before charging.`);}
 }catch(error){setMessage(error instanceof Error?error.message:'Unable to recover payment.');}finally{setBusy(false);}}
 return <AppScreen title="Recover previous payment" subtitle="Your sale and payment attempt are safely retained."><View style={{padding:20,gap:16,backgroundColor:theme.colors.surface,borderRadius:12}}><Text selectable style={{color:theme.colors.textMuted}}>Attempt {attempt.id}</Text><Text accessibilityRole="alert" style={{color:theme.colors.text}}>{message}</Text><Pressable disabled={busy} accessibilityRole="button" onPress={()=>check()} style={{minHeight:48,justifyContent:'center',backgroundColor:theme.colors.accent,padding:12,borderRadius:8}}><Text style={{color:theme.colors.accentText}}>{busy?'Checking…':'Check payment status'}</Text></Pressable>{canCancel&&<Pressable disabled={busy} accessibilityRole="button" onPress={()=>check(true)} style={{minHeight:48,justifyContent:'center'}}><Text style={{color:theme.colors.danger}}>Cancel unfinished payment</Text></Pressable>}</View></AppScreen>;
}
