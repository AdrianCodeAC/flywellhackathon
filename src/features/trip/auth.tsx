import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import "@lovable.dev/cloud-auth-js/styles.css";

const AuthContext=createContext<User|null>(null);
export function TripAuthProvider({children}:{children:ReactNode}) {
  const [user,setUser]=useState<User|null>(null);
  useEffect(()=>{
    const {data}=supabase.auth.onAuthStateChange((event,session)=>{
      if(["INITIAL_SESSION","SIGNED_IN","SIGNED_OUT","USER_UPDATED"].includes(event))setUser(session?.user??null);
    });
    void supabase.auth.getUser().then(({data})=>setUser(data.user));
    return ()=>data.subscription.unsubscribe();
  },[]);
  return <AuthContext.Provider value={user}>{children}</AuthContext.Provider>;
}
export const useTripUser=()=>useContext(AuthContext);
export function TripSignIn() {
  const {t}=useTranslation();const user=useTripUser();const [error,setError]=useState("");
  async function login(provider:"google"|"lovable"){
    const result=await lovable.auth.signInWithOAuth(provider,{redirect_uri:window.location.origin});
    if(result.error)setError(t("trip.authError"));
  }
  return <div className="flex flex-wrap items-center gap-2">
    {user?<><span className="text-sm text-muted-foreground">{t("trip.accountSaved")}</span><Button variant="ghost" className="min-h-11" onClick={()=>void supabase.auth.signOut()}>{t("trip.signOut")}</Button></>:<>
    <Button variant="outline" className="min-h-11" onClick={()=>void login("google")}>{t("trip.googleSignIn")}</Button>
    <Button variant="outline" className="lovable-auth-button min-h-11" onClick={()=>void login("lovable")}>{t("trip.lovableSignIn")}</Button></>}
    {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
  </div>;
}