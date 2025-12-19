export const NoItems = (props: {
  itemKind: string
  explanation?: string
  suggestion?: string
}) => {
  return (
    <div class="flex flex-1 flex-col items-center justify-center">
      <p>{props.explanation ? props.explanation : `No ${props.itemKind} found.`}</p>
      <img src="/thinking.png" class="max-h-96" alt="NotImplemented" />
      <p>
        {props.suggestion
          ? props.suggestion
          : `You can create a new ${props.itemKind.replace('s', '')} by clicking the button below.`}
      </p>
    </div>
  )
}
