import java.io.FileReader;
import java.io.BufferedReader;
import java.io.FileWriter;
import java.io.BufferedWriter;
import java.io.IOException;
import java.time.format.TextStyle;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.regex.*;

import javax.swing.text.html.HTML;

class HtmlParser{

    public StringBuilder builder;
    public List<String> textSnippets;
    public HashSet<String> regexes;

    public static void main(String[] args) {
        boolean debug = true;
        String inputfile = "";
        String outputfile = "";
        if(args.length < 2){
            inputfile = "test.txt";
            outputfile = "out.txt";
        }
        else if(args.length == 2){ 
        inputfile = args[0];
        outputfile = args[1];
        }
        else System.out.println("hmmm, something went wrong");
        HtmlParser p = new HtmlParser();
        p.start(inputfile,outputfile);
        try{
            BufferedWriter writer = new BufferedWriter(new FileWriter(outputfile, false));
            for(String s : p.textSnippets){
                writer.write(s);
                //writer.write("\n.....\n");
            }
            writer.close();
        }
        catch(IOException e){
            e.printStackTrace();
        }
        System.out.println("Done");
        
    }

    public HtmlParser(){
        this.builder = new StringBuilder();
        this.textSnippets = new ArrayList<>();
        this.regexes = new HashSet<>();
        this.regexes.add("<p style=\"text-align: left\">");
        this.regexes.add("<p style=\"text-align: left;\">");
        this.regexes.add("<li style=\"text-align: left;\">");
    }
    
    public void start(String in, String out){
        try{
            FileReader reader = new FileReader(in);
            BufferedReader bReader = new BufferedReader(reader,8192);
            String line = null;
            while((line = bReader.readLine()) != null){
                if(line.contains("Dokumenterade lokala")){
                    System.out.println("debug");
                }
                //do parse if match -> send reader to method: find text end -> pass the method to 
                for (String regex : this.regexes) {
                    if(line.contains(regex)){
                        cut(line);
                    }    
                }
                
            }
            bReader.close();
        } catch(IOException e){
            e.printStackTrace();
        }
        
    } 
    
    private void cut(String line){
        // Regex: >[TEXT]< or >[TEXT]$ (end of string)
       Pattern pattern = Pattern.compile(">([^<]+)<|>([^<]+)$");
       Matcher matcher = pattern.matcher(line);

       while(matcher.find()){
        if(matcher.group(1) != null){
            textSnippets.add(matcher.group(1));
        }
        else if(matcher.group(2) != null){
            textSnippets.add(matcher.group(2));
        }
       }
    }

    private void readUsefulText(BufferedReader br){

    }
}


